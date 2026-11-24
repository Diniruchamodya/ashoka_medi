import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import 'regenerator-runtime/runtime'
import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { OrderedTestResult } from '@/lib/db/schema'

const nodeRequire = createRequire(join(process.cwd(), 'package.json'))
const sinhalaFontPath = nodeRequire.resolve(
  '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-400-normal.woff2',
)
const tamilFontPath = nodeRequire.resolve(
  '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff2',
)
const ashokaLogoPath = join(process.cwd(), 'public', 'images', 'ashoka-logo.jpg')

type PdfTextRun = { text: string; font: PDFFont }
type Fonts = {
  regular: PDFFont
  bold: PDFFont
  sinhala: PDFFont
  tamil: PDFFont
}
type ReportColumn = {
  key: 'parameter' | 'result' | 'unit' | 'referenceInterval' | 'status'
  label: string
  weight: number
}
type ReportRow = {
  cells: { lines: PdfTextRun[][] }[]
  lineCount: number
  height: number
}

const COLORS = {
  teal: rgb(0.02, 0.29, 0.34),
  tealLight: rgb(0.91, 0.97, 0.98),
  ink: rgb(0.12, 0.16, 0.2),
  muted: rgb(0.34, 0.4, 0.44),
  border: rgb(0.78, 0.82, 0.84),
  stripe: rgb(0.97, 0.98, 0.98),
  white: rgb(1, 1, 1),
}

const REPORT_COLUMNS: ReportColumn[] = [
  { key: 'parameter', label: 'Parameter', weight: 1.8 },
  { key: 'result', label: 'Result', weight: 1.8 },
  { key: 'unit', label: 'Unit', weight: 0.9 },
  { key: 'referenceInterval', label: 'Reference Range', weight: 2 },
  { key: 'status', label: 'Status', weight: 0.9 },
]

const MARGIN = (18 / 25.4) * 72
const PAGE_WIDTH = PageSizes.A4[0]
const PAGE_HEIGHT = PageSizes.A4[1]
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const CONTENT_BOTTOM = MARGIN + 2
const TABLE_HEADER_HEIGHT = 30
const TABLE_LINE_HEIGHT = 12
const TABLE_CELL_PADDING = 6
const TABLE_ROW_PADDING = 12

function textRuns(
  value: string,
  fonts: Fonts,
  isBold: boolean,
): PdfTextRun[] {
  const runs: PdfTextRun[] = []
  for (const originalCharacter of Array.from(value.normalize('NFC'))) {
    let character = originalCharacter
    let font =
      /[\u0D80-\u0DFF]/u.test(character) ? fonts.sinhala :
        /[\u0B80-\u0BFF]/u.test(character) ? fonts.tamil :
          isBold ? fonts.bold : fonts.regular
    try {
      font.encodeText(character)
    } catch {
      font = isBold ? fonts.bold : fonts.regular
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

function appendRuns(target: PdfTextRun[], source: PdfTextRun[]) {
  for (const run of source) {
    const previous = target[target.length - 1]
    if (previous?.font === run.font) previous.text += run.text
    else target.push({ ...run })
  }
}

function wrapWord(word: string, width: number, size: number, fonts: Fonts, isBold: boolean) {
  const chunks: PdfTextRun[][] = []
  let chunk: PdfTextRun[] = []
  for (const character of Array.from(word)) {
    const characterRuns = textRuns(character, fonts, isBold)
    if (chunk.length && runsWidth([...chunk, ...characterRuns], size) > width) {
      chunks.push(chunk)
      chunk = []
    }
    appendRuns(chunk, characterRuns)
  }
  if (chunk.length || chunks.length === 0) chunks.push(chunk)
  return chunks
}

function wrapText(value: string, width: number, size: number, fonts: Fonts, isBold = false) {
  const lines: PdfTextRun[][] = []
  for (const paragraph of value.replace(/\r\n?/g, '\n').split('\n')) {
    let line: PdfTextRun[] = []
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    for (const word of words) {
      const chunks = wrapWord(word, width, size, fonts, isBold)
      const spaceRuns = line.length ? textRuns(' ', fonts, isBold) : []
      if (
        line.length &&
        runsWidth([...line, ...spaceRuns, ...chunks[0]], size) > width
      ) {
        lines.push(line)
        line = []
      } else if (line.length) {
        appendRuns(line, spaceRuns)
      }

      for (let index = 0; index < chunks.length; index += 1) {
        if (line.length && runsWidth([...line, ...chunks[index]], size) > width) {
          lines.push(line)
          line = []
        }
        appendRuns(line, chunks[index])
        if (index < chunks.length - 1) {
          lines.push(line)
          line = []
        }
      }
    }
    lines.push(line)
  }
  return lines.length ? lines : [[]]
}

function drawRuns(
  page: PDFPage,
  runs: PdfTextRun[],
  x: number,
  y: number,
  size: number,
  color = COLORS.ink,
) {
  let cursor = x
  for (const run of runs) {
    page.drawText(run.text, { x: cursor, y, size, font: run.font, color })
    cursor += run.font.widthOfTextAtSize(run.text, size)
  }
}

function drawWrappedText(
  page: PDFPage,
  value: string,
  x: number,
  top: number,
  width: number,
  size: number,
  fonts: Fonts,
  options: { bold?: boolean; color?: typeof COLORS.ink; lineHeight?: number } = {},
) {
  const lines = wrapText(value, width, size, fonts, options.bold ?? false)
  const lineHeight = options.lineHeight ?? size * 1.3
  lines.forEach((line, index) => {
    drawRuns(page, line, x, top - size - index * lineHeight, size, options.color)
  })
  return lines.length
}

function measureSection(
  fields: { label: string; value: string }[],
  width: number,
  fonts: Fonts,
) {
  const padding = 8
  const labelWidth = Math.min(82, width * 0.38)
  const valueWidth = width - padding * 2 - labelWidth - 8
  const rows = fields.map((field) => {
    const labelLines = wrapText(field.label, labelWidth, 8, fonts, true)
    const valueLines = wrapText(field.value, valueWidth, 9, fonts)
    return {
      labelLines,
      valueLines,
      height: Math.max(labelLines.length, valueLines.length, 1) * 12 + 8,
    }
  })
  return { rows, height: 25 + rows.reduce((total, row) => total + row.height, 0), padding, labelWidth, valueWidth }
}

function drawSection(
  page: PDFPage,
  title: string,
  fields: { label: string; value: string }[],
  x: number,
  top: number,
  width: number,
  fonts: Fonts,
) {
  const layout = measureSection(fields, width, fonts)
  const bottom = top - layout.height
  page.drawRectangle({
    x,
    y: bottom,
    width,
    height: layout.height,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 0.6,
  })
  page.drawRectangle({
    x,
    y: top - 25,
    width,
    height: 25,
    color: COLORS.tealLight,
  })
  drawWrappedText(page, title, x + 8, top - 6, width - 16, 9.5, fonts, {
    bold: true,
    color: COLORS.teal,
    lineHeight: 12,
  })

  let rowTop = top - 25
  layout.rows.forEach((row) => {
    const textTop = rowTop - 5
    const labelX = x + layout.padding
    const valueX = labelX + layout.labelWidth + 8
    row.labelLines.forEach((line, index) => {
      drawRuns(page, line, labelX, textTop - 8 - index * 12, 8, COLORS.muted)
    })
    row.valueLines.forEach((line, index) => {
      drawRuns(page, line, valueX, textTop - 9 - index * 12, 9, COLORS.ink)
    })
    rowTop -= row.height
    page.drawLine({
      start: { x: x + 7, y: rowTop },
      end: { x: x + width - 7, y: rowTop },
      thickness: 0.4,
      color: COLORS.border,
    })
  })
  return layout.height
}

function getColumns(resultData: OrderedTestResult) {
  const selected = new Set(resultData.columns)
  const hasFlags = resultData.parameters.some((parameter) => parameter.flag?.trim())
  return REPORT_COLUMNS.filter((column) =>
    column.key === 'status'
      ? hasFlags
      : selected.has(column.key),
  )
}

function prepareRows(
  resultData: OrderedTestResult,
  columns: ReportColumn[],
  widths: number[],
  fonts: Fonts,
): ReportRow[] {
  return resultData.parameters.map((parameter) => {
    const cells = columns.map((column, index) => {
      const value = column.key === 'parameter'
        ? parameter.name
        : column.key === 'result'
          ? parameter.value
          : column.key === 'unit'
            ? parameter.unit
            : column.key === 'referenceInterval'
              ? parameter.referenceInterval
              : parameter.flag ?? ''
      return {
        lines: wrapText(
          value,
          widths[index] - TABLE_CELL_PADDING * 2,
          9.5,
          fonts,
          false,
        ),
      }
    })
    const lineCount = Math.max(1, ...cells.map((cell) => cell.lines.length))
    return {
      cells,
      lineCount,
      height: lineCount * TABLE_LINE_HEIGHT + TABLE_ROW_PADDING,
    }
  })
}

function drawTableHeader(
  page: PDFPage,
  top: number,
  columns: ReportColumn[],
  widths: number[],
  fonts: Fonts,
) {
  page.drawRectangle({
    x: MARGIN,
    y: top - TABLE_HEADER_HEIGHT,
    width: CONTENT_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: COLORS.teal,
  })
  let x = MARGIN
  columns.forEach((column, index) => {
    drawWrappedText(
      page,
      column.label,
      x + TABLE_CELL_PADDING,
      top - 8,
      widths[index] - TABLE_CELL_PADDING * 2,
      9,
      fonts,
      { bold: true, color: COLORS.white, lineHeight: 11 },
    )
    x += widths[index]
  })
}

function drawRowSegment(
  page: PDFPage,
  row: ReportRow,
  rowIndex: number,
  top: number,
  startLine: number,
  lineCount: number,
  columns: ReportColumn[],
  widths: number[],
  fonts: Fonts,
) {
  const segmentHeight = lineCount * TABLE_LINE_HEIGHT + TABLE_ROW_PADDING
  const bottom = top - segmentHeight
  page.drawRectangle({
    x: MARGIN,
    y: bottom,
    width: CONTENT_WIDTH,
    height: segmentHeight,
    color: rowIndex % 2 === 0 ? COLORS.white : COLORS.stripe,
  })
  page.drawLine({
    start: { x: MARGIN, y: bottom },
    end: { x: PAGE_WIDTH - MARGIN, y: bottom },
    thickness: 0.55,
    color: COLORS.border,
  })

  let x = MARGIN
  row.cells.forEach((cell, index) => {
    const column = columns[index]
    const endLine = Math.min(startLine + lineCount, cell.lines.length)
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex += 1) {
      drawRuns(
        page,
        cell.lines[lineIndex],
        x + TABLE_CELL_PADDING,
        top - 6 - 9.5 - (lineIndex - startLine) * TABLE_LINE_HEIGHT,
        9.5,
        column.key === 'status' ? COLORS.teal : COLORS.ink,
      )
    }
    x += widths[index]
  })
  return segmentHeight
}

export async function createResultPdf({
  orderNumber,
  patientName,
  patientCode,
  patientPhone,
  branchName,
  partnerLabName,
  testName,
  testCode,
  orderedAt,
  resultData,
  resultSavedAt,
  blankTemplate,
}: {
  orderNumber: string
  patientName: string
  patientCode: string
  patientPhone: string | null
  branchName: string
  branchAddress: string | null
  branchPhone: string | null
  partnerLabName: string | null
  testName: string
  testCode: string | null
  orderedAt: string
  resultData: OrderedTestResult
  resultSavedAt: string | null
  blankTemplate: boolean
}) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const [logoBytes, sinhalaBytes, tamilBytes] = await Promise.all([
    readFile(ashokaLogoPath),
    readFile(sinhalaFontPath),
    readFile(tamilFontPath),
  ])
  const [logo, sinhala, tamil] = await Promise.all([
    pdf.embedJpg(logoBytes),
    pdf.embedFont(sinhalaBytes),
    pdf.embedFont(tamilBytes),
  ])
  const [regular, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ])
  const fonts: Fonts = { regular, bold, sinhala, tamil }

  pdf.setTitle(`Laboratory Report - ${orderNumber} - ${testName}`)
  pdf.setAuthor('Ashoka Medi-Lab')
  pdf.setSubject(`Laboratory report for ${testName}`)

  const addWhitePage = () => {
    const newPage = pdf.addPage(PageSizes.A4)
    newPage.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: COLORS.white,
    })
    return newPage
  }
  let page = addWhitePage()
  let y = PAGE_HEIGHT - MARGIN
  const startNewPage = () => {
    page = addWhitePage()
    y = PAGE_HEIGHT - MARGIN
  }

  const logoSize = logo.scaleToFit(52, 52)
  page.drawImage(logo, {
    x: MARGIN,
    y: y - logoSize.height,
    width: logoSize.width,
    height: logoSize.height,
  })
  const brandX = MARGIN + logoSize.width + 12
  const brandWidth = CONTENT_WIDTH - logoSize.width - 12
  drawWrappedText(page, 'Ashoka Medi-Lab', brandX, y - 5, brandWidth, 18, fonts, {
    bold: true,
    color: COLORS.teal,
    lineHeight: 22,
  })
  const addressLines = drawWrappedText(
    page,
    'No. 21, Braybrook Street, Hambantota, Sri Lanka',
    brandX,
    y - 27,
    brandWidth,
    9,
    fonts,
    { color: COLORS.muted, lineHeight: 12 },
  )
  const phoneLines = drawWrappedText(
    page,
    'Phone: 070 601 0601',
    brandX,
    y - 27 - addressLines * 12,
    brandWidth,
    9,
    fonts,
    { color: COLORS.muted, lineHeight: 12 },
  )
  y -= Math.max(logoSize.height, 31 + (addressLines + phoneLines) * 12) + 13
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.4,
    color: COLORS.teal,
  })
  y -= 18

  drawWrappedText(page, 'LABORATORY REPORT', MARGIN, y, CONTENT_WIDTH, 9.5, fonts, {
    bold: true,
    color: COLORS.teal,
    lineHeight: 12,
  })
  y -= 17
  const testNameLines = drawWrappedText(page, testName, MARGIN, y, CONTENT_WIDTH, 18, fonts, {
    bold: true,
    lineHeight: 22,
  })
  y -= testNameLines * 22 + 2
  if (testCode) {
    const codeLines = drawWrappedText(
      page,
      `Test code: ${testCode}`,
      MARGIN,
      y,
      CONTENT_WIDTH,
      9.5,
      fonts,
      { color: COLORS.muted, lineHeight: 12 },
    )
    y -= codeLines * 12
  }
  y -= 15

  const patientFields = [
    { label: 'Patient Name', value: patientName },
    { label: 'Patient ID', value: patientCode },
    { label: 'Phone', value: patientPhone || '—' },
  ]
  const orderFields = [
    { label: 'Order No', value: orderNumber },
    { label: 'Branch', value: branchName },
    { label: 'Ordered Date/Time', value: orderedAt },
    { label: 'Result Saved Date/Time', value: resultSavedAt ?? '—' },
    ...(partnerLabName ? [{ label: 'Partner Lab', value: partnerLabName }] : []),
  ]
  const sectionGap = 14
  const sectionWidth = (CONTENT_WIDTH - sectionGap) / 2
  const patientLayout = measureSection(patientFields, sectionWidth, fonts)
  const orderLayout = measureSection(orderFields, sectionWidth, fonts)
  const sectionHeight = Math.max(patientLayout.height, orderLayout.height)
  if (y - sectionHeight < CONTENT_BOTTOM + TABLE_HEADER_HEIGHT + 45) startNewPage()
  drawSection(page, 'Patient Information', patientFields, MARGIN, y, sectionWidth, fonts)
  drawSection(
    page,
    'Order Details',
    orderFields,
    MARGIN + sectionWidth + sectionGap,
    y,
    sectionWidth,
    fonts,
  )
  y -= sectionHeight + 18

  if (blankTemplate) {
    const label = 'Blank template — results not entered'
    page.drawRectangle({
      x: MARGIN,
      y: y - 25,
      width: CONTENT_WIDTH,
      height: 25,
      color: COLORS.tealLight,
      borderColor: COLORS.border,
      borderWidth: 0.5,
    })
    drawWrappedText(page, label, MARGIN + 9, y - 7, CONTENT_WIDTH - 18, 9, fonts, {
      bold: true,
      color: COLORS.teal,
    })
    y -= 35
  }

  const columns = getColumns(resultData)
  const widths = columns.length
    ? columns.map((column) =>
        CONTENT_WIDTH * column.weight / columns.reduce((total, current) => total + current.weight, 0),
      )
    : []
  const rows = prepareRows(resultData, columns, widths, fonts)
  const firstRowHeight = rows[0]?.height ?? 28
  if (y - 18 - TABLE_HEADER_HEIGHT - Math.min(firstRowHeight, 48) < CONTENT_BOTTOM) {
    startNewPage()
  }
  drawWrappedText(page, 'Results', MARGIN, y, CONTENT_WIDTH, 11, fonts, {
    bold: true,
    color: COLORS.teal,
    lineHeight: 14,
  })
  y -= 18

  if (columns.length === 0) {
    drawWrappedText(page, 'No report columns are configured.', MARGIN, y, CONTENT_WIDTH, 9.5, fonts)
  } else {
    const drawHeader = () => {
      drawTableHeader(page, y, columns, widths, fonts)
      y -= TABLE_HEADER_HEIGHT
    }
    drawHeader()

    const maxKeptRowHeight = PAGE_HEIGHT - MARGIN * 2 - TABLE_HEADER_HEIGHT - TABLE_ROW_PADDING
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      if (row.height <= maxKeptRowHeight) {
        if (y - row.height < CONTENT_BOTTOM) {
          startNewPage()
          drawHeader()
        }
        y -= drawRowSegment(page, row, rowIndex, y, 0, row.lineCount, columns, widths, fonts)
        continue
      }

      let startLine = 0
      while (startLine < row.lineCount) {
        let availableLines = Math.floor(
          (y - CONTENT_BOTTOM - TABLE_ROW_PADDING) / TABLE_LINE_HEIGHT,
        )
        if (availableLines < 1) {
          startNewPage()
          drawHeader()
          availableLines = Math.floor(
            (y - CONTENT_BOTTOM - TABLE_ROW_PADDING) / TABLE_LINE_HEIGHT,
          )
        }
        const lineCount = Math.min(availableLines, row.lineCount - startLine)
        y -= drawRowSegment(
          page,
          row,
          rowIndex,
          y,
          startLine,
          lineCount,
          columns,
          widths,
          fonts,
        )
        startLine += lineCount
        if (startLine < row.lineCount) {
          startNewPage()
          drawHeader()
        }
      }
    }
  }

  const pages = pdf.getPages()
  pages.forEach((currentPage, index) => {
    const footerY = MARGIN - 13
    currentPage.drawLine({
      start: { x: MARGIN, y: footerY },
      end: { x: PAGE_WIDTH - MARGIN, y: footerY },
      thickness: 0.6,
      color: COLORS.border,
    })
    drawWrappedText(currentPage, 'Ashoka Medi-Lab', MARGIN, footerY - 6, 180, 8, fonts, {
      bold: true,
      color: COLORS.muted,
    })
    const pageNumber = `Page ${index + 1} of ${pages.length}`
    const pageNumberWidth = regular.widthOfTextAtSize(pageNumber, 8)
    drawWrappedText(
      currentPage,
      pageNumber,
      PAGE_WIDTH - MARGIN - pageNumberWidth,
      footerY - 6,
      pageNumberWidth + 2,
      8,
      fonts,
      { color: COLORS.muted },
    )
  })

  return pdf.save()
}
