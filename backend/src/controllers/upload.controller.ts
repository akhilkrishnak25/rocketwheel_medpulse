import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { successResponse, errorResponse } from '../utils/response';

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const REPORTS_DIR = path.join(UPLOAD_ROOT, 'reports');
const AVATARS_DIR = path.join(UPLOAD_ROOT, 'avatars');

try {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize uploads directories:', e);
}

export class UploadController {
  static async uploadReportPdf(req: Request, res: Response) {
    try {
      const { fileName, fileData } = req.body;
      if (!fileData) {
        return errorResponse(res, 'File data (base64) is required', 400);
      }

      let base64Content = fileData;
      let extension = '.pdf';

      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return errorResponse(res, 'Invalid base64 data format', 400);
        }
        const mime = matches[1];
        if (mime !== 'application/pdf' && !mime.includes('pdf')) {
          return errorResponse(res, 'Only PDF documents are allowed for diagnostic reports', 400);
        }
        base64Content = matches[2];
      }

      const buffer = Buffer.from(base64Content, 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        return errorResponse(res, 'File size exceeds 10MB limit', 400);
      }

      const randomName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;
      const filePath = path.join(REPORTS_DIR, randomName);
      fs.writeFileSync(filePath, buffer);

      const url = `/uploads/reports/${randomName}`;
      return successResponse(
        res,
        {
          url,
          fileName: fileName || randomName,
          size: buffer.length,
        },
        'Diagnostic PDF report uploaded successfully',
        201
      );
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to upload report', 500);
    }
  }

  static async uploadProfilePhoto(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 'Authentication required to update profile photo', 401);
      }

      const { fileData } = req.body;
      if (!fileData) {
        return errorResponse(res, 'Image data (base64) is required', 400);
      }

      let base64Content = fileData;
      let extension = '.jpg';

      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return errorResponse(res, 'Invalid image data format. Must be PNG, JPEG, or WEBP.', 400);
        }
        let ext = matches[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        if (!['jpg', 'png', 'webp', 'svg'].includes(ext)) {
          return errorResponse(res, 'Only JPG, PNG, and WEBP images are supported', 400);
        }
        extension = `.${ext}`;
        base64Content = matches[2];
      }

      const buffer = Buffer.from(base64Content, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return errorResponse(res, 'Profile photo size exceeds 5MB limit', 400);
      }

      const randomName = `avatar-${userId}-${Date.now()}${extension}`;
      const filePath = path.join(AVATARS_DIR, randomName);
      fs.writeFileSync(filePath, buffer);

      const url = `/uploads/avatars/${randomName}`;

      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: url },
      });

      if (req.user?.role === 'DOCTOR' && req.user.doctorId) {
        await prisma.doctor.update({
          where: { id: req.user.doctorId },
          data: { photoUrl: url },
        });
      }

      return successResponse(res, { url }, 'Profile photo updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to upload profile photo', 500);
    }
  }

  static async removeProfilePhoto(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 'Authentication required', 401);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      });

      if (req.user?.role === 'DOCTOR' && req.user.doctorId) {
        await prisma.doctor.update({
          where: { id: req.user.doctorId },
          data: { photoUrl: null },
        });
      }

      return successResponse(res, { url: null }, 'Profile photo removed successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to remove profile photo', 500);
    }
  }
}
