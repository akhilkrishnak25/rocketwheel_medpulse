import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { successResponse, errorResponse } from '../utils/response';
import { generateLabReportPdf } from '../utils/pdf';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
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
      try {
        fs.writeFileSync(filePath, buffer);
      } catch (writeErr) {
        console.warn('Failed to write report to local disk (may be ephemeral):', writeErr);
      }

      const url = `/uploads/reports/${randomName}`;

      // Persist to PostgreSQL database to survive Render ephemeral disk restarts
      try {
        await prisma.storedFile.upsert({
          where: { path: url },
          create: {
            path: url,
            filename: randomName,
            mimeType: 'application/pdf',
            fileData: base64Content,
            size: buffer.length,
          },
          update: {
            fileData: base64Content,
            size: buffer.length,
          },
        });
      } catch (dbErr) {
        console.warn('Could not persist report to StoredFile database:', dbErr);
      }

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
      let mimeType = 'image/jpeg';

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
        mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        base64Content = matches[2];
      }

      const buffer = Buffer.from(base64Content, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return errorResponse(res, 'Profile photo size exceeds 5MB limit', 400);
      }

      const randomName = `avatar-${userId}-${Date.now()}${extension}`;
      const filePath = path.join(AVATARS_DIR, randomName);
      try {
        fs.writeFileSync(filePath, buffer);
      } catch (writeErr) {
        console.warn('Failed to write avatar to local disk (may be ephemeral):', writeErr);
      }

      const url = `/uploads/avatars/${randomName}`;

      // Persist to PostgreSQL database to survive Render ephemeral disk restarts
      try {
        await prisma.storedFile.upsert({
          where: { path: url },
          create: {
            path: url,
            filename: randomName,
            mimeType,
            fileData: base64Content,
            size: buffer.length,
          },
          update: {
            fileData: base64Content,
            size: buffer.length,
          },
        });
      } catch (dbErr) {
        console.warn('Could not persist avatar to StoredFile database:', dbErr);
      }

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

      // Automatically sync Hospital logo & image if user is Hospital Admin or Sub-Admin
      if (req.user?.role === 'HOSPITAL_ADMIN' || req.user?.role === 'HOSPITAL_SUB_ADMIN') {
        let hospitalId = req.user?.hospitalId;
        if (!hospitalId) {
          const adminRec = await prisma.hospitalAdmin.findFirst({ where: { userId } });
          if (adminRec) hospitalId = adminRec.hospitalId;
        }
        if (!hospitalId) {
          const subAdminRec = await prisma.hospitalSubAdmin.findFirst({ where: { userId } });
          if (subAdminRec) hospitalId = subAdminRec.hospitalId;
        }

        if (hospitalId) {
          await prisma.hospital.update({
            where: { id: hospitalId },
            data: {
              logoUrl: url,
              imageUrl: url,
            },
          });
        }
      }

      return successResponse(res, { url }, 'Profile photo updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to upload profile photo', 500);
    }
  }

  static async uploadHospitalAsset(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, 'Authentication required', 401);
      }

      let hospitalId = req.user?.hospitalId;
      if (!hospitalId) {
        const adminRec = await prisma.hospitalAdmin.findFirst({ where: { userId } });
        if (adminRec) hospitalId = adminRec.hospitalId;
      }
      if (!hospitalId) {
        const subAdminRec = await prisma.hospitalSubAdmin.findFirst({ where: { userId } });
        if (subAdminRec) hospitalId = subAdminRec.hospitalId;
      }
      if (!hospitalId && req.user?.role === 'SUPER_ADMIN') {
        hospitalId = req.body.hospitalId;
      }

      if (!hospitalId) {
        return errorResponse(res, 'Hospital not associated with this account', 403);
      }

      const { fileData, assetType = 'both' } = req.body;
      if (!fileData) {
        return errorResponse(res, 'Image data (base64) is required', 400);
      }

      let base64Content = fileData;
      let extension = '.jpg';
      let mimeType = 'image/jpeg';

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
        mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        base64Content = matches[2];
      }

      const buffer = Buffer.from(base64Content, 'base64');
      if (buffer.length > 8 * 1024 * 1024) {
        return errorResponse(res, 'Hospital image size exceeds 8MB limit', 400);
      }

      const randomName = `hospital-${hospitalId}-${assetType}-${Date.now()}${extension}`;
      const filePath = path.join(AVATARS_DIR, randomName);
      try {
        fs.writeFileSync(filePath, buffer);
      } catch (writeErr) {
        console.warn('Failed to write hospital image to disk:', writeErr);
      }

      const url = `/uploads/avatars/${randomName}`;

      // Persist to StoredFile database
      try {
        await prisma.storedFile.upsert({
          where: { path: url },
          create: {
            path: url,
            filename: randomName,
            mimeType,
            fileData: base64Content,
            size: buffer.length,
          },
          update: {
            fileData: base64Content,
            size: buffer.length,
          },
        });
      } catch (dbErr) {
        console.warn('Could not persist hospital asset to database:', dbErr);
      }

      const updateData: any = {};
      if (assetType === 'logo') {
        updateData.logoUrl = url;
      } else if (assetType === 'cover') {
        updateData.imageUrl = url;
      } else {
        updateData.logoUrl = url;
        updateData.imageUrl = url;
      }

      const updated = await prisma.hospital.update({
        where: { id: hospitalId },
        data: updateData,
      });

      // Keep user avatar in sync if logo or both
      if (assetType === 'logo' || assetType === 'both') {
        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: url },
        });
      }

      return successResponse(res, { url, hospital: updated }, 'Hospital image updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to upload hospital asset', 500);
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

  /**
   * Resilient upload serving middleware
   * 1. Checks local disk
   * 2. Checks PostgreSQL StoredFile database (auto-restores to disk)
   * 3. For reports, auto-resurrects on-the-fly from LabReport database records
   * 4. For avatars, provides default SVG if missing
   */
  static async serveUploadedFile(req: Request, res: Response) {
    try {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let reqPath = req.path || '';
      // Strip leading slash
      if (reqPath.startsWith('/')) reqPath = reqPath.slice(1);

      const parts = reqPath.split('/');
      let folder = parts[0] || '';
      let filename = parts.slice(1).join('/') || '';

      // If called from route /uploads/:folder/:filename
      if (req.params.folder) {
        folder = Array.isArray(req.params.folder) ? req.params.folder[0] : req.params.folder;
      }
      if (req.params.filename) {
        filename = Array.isArray(req.params.filename) ? req.params.filename.join('/') : req.params.filename;
      }

      if (!folder || !filename) {
        return res.status(404).json({ success: false, message: 'File path not specified' });
      }

      const filePath = path.join(UPLOAD_ROOT, folder, filename);

      // 1. Check if file is physically present on disk
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }

      // 2. Check StoredFile in database (survives container restarts)
      const lookupUrl = `/uploads/${folder}/${filename}`;
      const stored = await prisma.storedFile.findFirst({
        where: {
          OR: [{ path: lookupUrl }, { filename: filename }],
        },
      });

      if (stored && stored.fileData) {
        const fileBuffer = Buffer.from(stored.fileData, 'base64');
        try {
          // Re-hydrate to local disk for fast subsequent reads
          const targetDir = path.join(UPLOAD_ROOT, folder);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(filePath, fileBuffer);
        } catch (e) {}

        res.setHeader('Content-Type', stored.mimeType || (folder === 'reports' ? 'application/pdf' : 'image/jpeg'));
        res.setHeader('Content-Length', fileBuffer.length);
        return res.send(fileBuffer);
      }

      // 3. If it's a diagnostic report PDF, look up LabReport in database and resurrect it!
      if (folder === 'reports') {
        const labReport = await prisma.labReport.findFirst({
          where: {
            OR: [
              { fileUrl: { contains: filename } },
              { testRequest: { requestNumber: { contains: filename.replace(/\.pdf$/i, '') } } },
            ],
          },
          include: {
            testRequest: {
              include: {
                patient: true,
                hospital: true,
                doctor: { include: { department: true } },
                lab: true,
              },
            },
          },
        });

        if (labReport) {
          const generatedPdf = await generateLabReportPdf(labReport);
          try {
            // Save to disk and StoredFile
            const targetDir = path.join(UPLOAD_ROOT, 'reports');
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            fs.writeFileSync(filePath, generatedPdf);

            await prisma.storedFile.upsert({
              where: { path: lookupUrl },
              create: {
                path: lookupUrl,
                filename: filename,
                mimeType: 'application/pdf',
                fileData: generatedPdf.toString('base64'),
                size: generatedPdf.length,
              },
              update: {
                fileData: generatedPdf.toString('base64'),
                size: generatedPdf.length,
              },
            });
          } catch (e) {}

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
          return res.send(generatedPdf);
        }
      }

      // 4. If it's an avatar and not found, return a default healthcare avatar SVG instead of broken 404
      if (folder === 'avatars') {
        const fallbackSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#eff6ff"/>
            <circle cx="100" cy="75" r="40" fill="#1E20E0" opacity="0.85"/>
            <path d="M30 180 C30 130, 70 120, 100 120 C130 120, 170 130, 170 180 Z" fill="#1E20E0" opacity="0.85"/>
          </svg>
        `.trim();
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(fallbackSvg);
      }

      return res.status(404).json({
        success: false,
        message: `File '${filename}' not found on server`,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Error serving uploaded asset',
      });
    }
  }
}
