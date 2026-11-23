import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import 'regenerator-runtime/runtime'
import * as fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  branches,
  orderItemResults,
  orderItems,
  orders,
  patients,
  tests,
  type OrderedTestResult,
} from '@/lib/db/schema'
import { formatDateTime } from '@/lib/format'
import { can } from '@/lib/permissions'
import { getStaffContext } from '@/lib/staff'

export const runtime = 'nodejs'

const nodeRequire = createRequire(join(process.cwd(), 'package.json'))
const sinhalaFontPath = nodeRequire.resolve(
  '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-400-normal.woff2',
)
const tamilFontPath = nodeRequire.resolve(
  '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff2',
)

type PdfTextRun = { text: string; font: PDFFont }

function textRuns(
  value: string,
  regular: PDFFont,
  bold: PDFFont,
  sinhala: PDFFont,
  tamil: PDFFont,
  isBold: boolean,
) {
  const runs: PdfTextRun[] = []
  for (const originalCharacter of Array.from(value.normalize('NFC'))) {
    let character = originalCharacter
    let font =
      /[\u0D80-\u0DFF]/u.test(character) ? sinhala :
        /[\u0B80-\u0BFF]/u.test(character) ? tamil :
          isBold ? bold : regular
    try {
      font.encodeText(character)
    } catch {
      font = isBold ? bold : regular
      try {
        font.encodeText(character)
      } catch {
        character = '?'
      }
    }

    const previous = runs[runs.length - 1]
    if (previous?.font === font) previous.text += character
    else runs.push({ text: character, font })
  }
  return runs
}

function runsWidth(runs: PdfTextRun[], size: number) {
  return runs.reduce((width, run) => width + run.font.widthOfTextAtSize(run.text, size), 0)
}

function wrapText(
  text: string,
  regular: PDFFont,
  bold: PDFFont,
  sinhala: PDFFont,
  tamil: PDFFont,
  size: number,
  width: number,
  isBold: boolean,
) {
  const words = text.split(/\s+/)
  const lines: PdfTextRun[][] = []
  let line: PdfTextRun[] = []
  for (const word of words) {
    const wordRuns = textRuns(word, regular, bold, sinhala, tamil, isBold)
    const candidate = line.length
      ? [...line, ...textRuns(' ', regular, bold, sinhala, tamil, isBold), ...wordRuns]
      : wordRuns
    if (line.length && runsWidth(candidate, size) > width) {
      lines.push(line)
      line = wordRuns
    } else {
      line = candidate
    }
  }
  if (line.length || lines.length === 0) lines.push(line)
  return lines
}

async function createResultPdf({
  orderNumber,
  patientName,
  patientPhone,
  branchName,
  testName,
  testCode,
  orderedAt,
  resultData,
  resultSavedAt,
}: {
  orderNumber: string
  patientName: string
  patientPhone: string | null
  branchName: string
  testName: string
  testCode: string | null
  orderedAt: Date
  resultData: OrderedTestResult
  resultSavedAt: Date
}) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const [sinhalaBytes, tamilBytes] = await Promise.all([
    readFile(sinhalaFontPath),
    readFile(tamilFontPath),
  ])
  const [sinhala, tamil] = await Promise.all([
    pdf.embedFont(sinhalaBytes),
    pdf.embedFont(tamilBytes),
  ])
  pdf.setTitle(`Test Result - ${orderNumber} - ${testName}`)
  pdf.setAuthor('Ashoka Medi-Lab')

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const margin = 48
  const contentWidth = PageSizes.A4[0] - margin * 2
  let page = pdf.addPage(PageSizes.A4)
  let y = PageSizes.A4[1] - margin

  const addText = (value: string, size = 10, isBold = false, gap = 5) => {
    const lines = wrapText(value, regular, bold, sinhala, tamil, size, contentWidth, isBold)
    for (const line of lines) {
      if (y < margin + size + gap) {
        page = pdf.addPage(PageSizes.A4)
        y = PageSizes.A4[1] - margin
      }
      let x = margin
      for (const run of line) {
        page.drawText(run.text, {
          x,
          y,
          size,
          font: run.font,
          color: rgb(0.12, 0.16, 0.22),
        })
        x += run.font.widthOfTextAtSize(run.text, size)
      }
      y -= size + gap
    }
  }

  addText('ASHOKA MEDI-LAB', 16, true, 9)
  addText('TEST RESULT', 12, true, 12)
  addText(`Order No: ${orderNumber}`)
  addText(`Patient: ${patientName}`)
  addText(`Phone: ${patientPhone || '—'}`)
  addText(`Branch: ${branchName}`)
  addText(`Test: ${testName}${testCode ? ` (${testCode})` : ''}`)
  addText(`Ordered: ${formatDateTime(orderedAt)}`)
  addText(`Result saved: ${formatDateTime(resultSavedAt)}`, 9, false, 12)
  addText('Results', 11, true, 8)

  const columns = new Set(resultData.columns)
  for (const parameter of resultData.parameters) {
    addText(parameter.name, 10, true, 3)
    addText(`Result: ${parameter.value}`, 10, false, 3)
    if (columns.has('unit') && parameter.unit) addText(`Unit: ${parameter.unit}`, 9, false, 3)
    if (columns.has('referenceInterval') && parameter.referenceInterval) {
      addText(`Reference interval: ${parameter.referenceInterval}`, 9, false, 8)
    }
  }

  return pdf.save()
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const staff = await getStaffContext()
  if (!staff?.profile || !staff.activeBranch || !can(staff.profile.role, 'orders.view')) {
    return new Response('Not found', { status: 404 })
  }

  const itemId = Number((await params).itemId)
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return new Response('Not found', { status: 404 })
  }

  const [item] = await db
    .select({
      orderNumber: orders.orderNumber,
      orderedAt: orders.createdAt,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      branchName: branches.name,
      testName: orderItems.testName,
      testCode: tests.code,
      itemStatus: orderItems.status,
      legacyResult: orderItems.result,
      resultData: orderItemResults.resultData,
      resultSavedAt: orderItemResults.updatedAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(patients, eq(patients.id, orders.patientId))
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .leftJoin(tests, eq(tests.id, orderItems.testId))
    .leftJoin(orderItemResults, eq(orderItemResults.orderItemId, orderItems.id))
    .where(and(
      eq(orderItems.id, itemId),
      inArray(orders.branchId, staff.branches.map((branch) => branch.id)),
    ))
    .limit(1)

  if (!item || (item.itemStatus !== 'completed' && !item.resultData)) {
    return new Response('Not found', { status: 404 })
  }

  const legacyValue = item.legacyResult?.trim()
  if (
    !item.resultData &&
    (item.itemStatus !== 'completed' || !legacyValue || legacyValue.toLowerCase() === 'completed')
  ) {
    return new Response('Result is not ready.', { status: 409 })
  }

  const resultData: OrderedTestResult = item.resultData ?? {
    columns: ['parameter', 'result'],
    parameters: [{
      name: 'Result',
      value: legacyValue!,
      unit: '',
      referenceInterval: '',
    }],
  }
  const pdfBytes = await createResultPdf({
    orderNumber: item.orderNumber,
    patientName: item.patientName,
    patientPhone: item.patientPhone,
    branchName: item.branchName,
    testName: item.testName,
    testCode: item.testCode,
    orderedAt: item.orderedAt,
    resultData,
    resultSavedAt: item.resultSavedAt ?? item.orderedAt,
  })
  const fileOrderNumber = item.orderNumber.replace(/[^A-Za-z0-9._-]/g, '_')

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="result-${fileOrderNumber}-${itemId}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
