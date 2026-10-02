const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const standardTests = [
  {
    code: 'CBC01',
    name: 'Complete Blood Count (CBC)',
    category: 'Hematology',
    description: 'Measures RBC, WBC, Platelets, Hemoglobin, and Hematocrit to assess overall health.',
    tatHours: 6,
    price: 350,
  },
  {
    code: 'LIP02',
    name: 'Lipid Profile (Cholesterol, HDL, LDL, Triglycerides)',
    category: 'Biochemistry',
    description: 'Evaluates cardiovascular risk and cholesterol balance.',
    tatHours: 8,
    price: 600,
  },
  {
    code: 'LFT03',
    name: 'Liver Function Test (LFT)',
    category: 'Biochemistry',
    description: 'Measures Bilirubin, SGOT/AST, SGPT/ALT, Alkaline Phosphatase, and Total Protein.',
    tatHours: 8,
    price: 750,
  },
  {
    code: 'KFT04',
    name: 'Kidney Function Test (KFT / RFT)',
    category: 'Biochemistry',
    description: 'Measures Serum Creatinine, Blood Urea Nitrogen (BUN), and Uric Acid.',
    tatHours: 8,
    price: 700,
  },
  {
    code: 'GLU05',
    name: 'Fasting Blood Glucose (FBS)',
    category: 'Diabetes Care',
    description: 'Standard screening and monitoring for diabetes mellitus.',
    tatHours: 4,
    price: 150,
  },
  {
    code: 'HBA06',
    name: 'HbA1c (Glycated Hemoglobin)',
    category: 'Diabetes Care',
    description: 'Assesses 3-month glycemic control.',
    tatHours: 6,
    price: 500,
  },
  {
    code: 'THY07',
    name: 'Thyroid Profile (Total T3, Total T4, TSH)',
    category: 'Endocrinology',
    description: 'Assesses thyroid gland function for hyperthyroidism and hypothyroidism.',
    tatHours: 12,
    price: 650,
  },
  {
    code: 'URI08',
    name: 'Urine Routine & Microscopic Examination',
    category: 'Clinical Pathology',
    description: 'Screens for urinary tract infections, kidney disorders, and metabolic conditions.',
    tatHours: 4,
    price: 200,
  },
  {
    code: 'VIT09',
    name: 'Vitamin D 25-Hydroxy',
    category: 'Specialized Immunology',
    description: 'Assesses bone health and vitamin D deficiency.',
    tatHours: 24,
    price: 1200,
  },
  {
    code: 'ELE10',
    name: 'Serum Electrolytes (Sodium, Potassium, Chloride)',
    category: 'Biochemistry',
    description: 'Measures body fluid balance and ionic concentration.',
    tatHours: 6,
    price: 550,
  },
  {
    code: 'XRY11',
    name: 'Digital Chest X-Ray (PA View)',
    category: 'Radiology',
    description: 'Radiographic examination of the chest, lungs, and heart.',
    tatHours: 2,
    price: 450,
  },
];

async function seed() {
  console.log('Seeding approved laboratories and test catalog...');
  
  // 1. Ensure existing labs are approved
  await prisma.lab.updateMany({
    data: { status: 'APPROVED' },
  });

  const labs = await prisma.lab.findMany();
  console.log(`Found ${labs.length} laboratories.`);

  for (const lab of labs) {
    for (const t of standardTests) {
      const existing = await prisma.labTest.findFirst({
        where: { labId: lab.id, code: t.code },
      });

      if (!existing) {
        await prisma.labTest.create({
          data: {
            labId: lab.id,
            hospitalId: lab.hospitalId,
            code: t.code,
            name: t.name,
            category: t.category,
            description: t.description,
            tatHours: t.tatHours,
            price: t.price,
            status: 'ACTIVE',
          },
        });
      } else {
        await prisma.labTest.update({
          where: { id: existing.id },
          data: {
            name: t.name,
            category: t.category,
            description: t.description,
            tatHours: t.tatHours,
            price: t.price,
            status: 'ACTIVE',
          },
        });
      }
    }
  }

  const totalTests = await prisma.labTest.count();
  console.log(`Seeding complete. Total active LabTest records: ${totalTests}`);
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
