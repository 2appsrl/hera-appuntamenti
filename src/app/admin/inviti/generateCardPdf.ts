import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface CardData {
  agentName: string
  sportelloName: string
  sportelloAddress: string
  sportelloPhone: string | null
}

const A4_W = 595
const A4_H = 842
const CARD_W = 297.638
const CARD_H = 419.528

interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

const GREEN = rgb(0.18, 0.49, 0.2)
const GREEN_DARK = rgb(0.08, 0.32, 0.18)
const GREEN_BG = rgb(0.94, 0.99, 0.95)
const GREEN_BORDER = rgb(0.82, 0.96, 0.87)
const MAGENTA = rgb(0.76, 0.1, 0.56)
const GRAY_FOOTER = rgb(0.98, 0.98, 0.98)
const GRAY_TEXT = rgb(0.42, 0.45, 0.5)
const GRAY_LABEL = rgb(0.61, 0.64, 0.69)
const GRAY_LINE = rgb(0.9, 0.91, 0.93)
const GRAY_CROP = rgb(0.6, 0.6, 0.6)
const WHITE = rgb(1, 1, 1)

async function buildQrPng(address: string): Promise<Buffer> {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  return QRCode.toBuffer(url, { width: 240, margin: 0 })
}

async function drawCard(
  page: PDFPage,
  doc: PDFDocument,
  origin: { x: number; topY: number },
  data: CardData,
  fonts: Fonts,
  logo: PDFImage | null,
): Promise<void> {
  const x = origin.x
  const top = origin.topY
  const yFromTop = (offset: number) => top - offset

  // 1. Brand logo (top-left). Falls back to the dashed magenta placeholder if
  // the official asset is missing on disk.
  if (logo) {
    const logoMaxW = 200
    const logoMaxH = 50
    const aspect = logo.width / logo.height
    let drawW = logoMaxW
    let drawH = drawW / aspect
    if (drawH > logoMaxH) {
      drawH = logoMaxH
      drawW = drawH * aspect
    }
    page.drawImage(logo, {
      x: x + 18,
      y: yFromTop(10 + drawH),
      width: drawW,
      height: drawH,
    })
  } else {
    page.drawRectangle({
      x: x + 20,
      y: yFromTop(40),
      width: 140,
      height: 28,
      borderColor: MAGENTA,
      borderWidth: 1.2,
      borderDashArray: [3, 2.5],
    })
    const logoLabel = 'LOGO HERACOMM'
    const logoLabelSize = 9
    const logoLabelW = fonts.bold.widthOfTextAtSize(logoLabel, logoLabelSize)
    page.drawText(logoLabel, {
      x: x + 20 + (140 - logoLabelW) / 2,
      y: yFromTop(28),
      size: logoLabelSize,
      font: fonts.bold,
      color: MAGENTA,
    })
  }
  // Separator line below the brand band
  page.drawLine({
    start: { x: x + 16, y: yFromTop(68) },
    end: { x: x + CARD_W - 16, y: yFromTop(68) },
    thickness: 0.6,
    color: GRAY_LINE,
  })

  // 2. Headline (3 lines, with SEMPLIFICARE in green)
  const headlineSize = 13.5
  const line1 = 'Vieni a scoprire come possiamo'
  const line2a = 'SEMPLIFICARE'
  const line2b = ' le pratiche luce'
  const line3 = 'e gas dei tuoi clienti.'
  page.drawText(line1, {
    x: x + 20,
    y: yFromTop(82),
    size: headlineSize,
    font: fonts.bold,
  })
  page.drawText(line2a, {
    x: x + 20,
    y: yFromTop(100),
    size: headlineSize,
    font: fonts.bold,
    color: GREEN,
  })
  const w2a = fonts.bold.widthOfTextAtSize(line2a, headlineSize)
  page.drawText(line2b, {
    x: x + 20 + w2a,
    y: yFromTop(100),
    size: headlineSize,
    font: fonts.bold,
  })
  page.drawText(line3, {
    x: x + 20,
    y: yFromTop(118),
    size: headlineSize,
    font: fonts.bold,
  })

  // 3. Services list (4 bullet items)
  const services = [
    'Nuovi allacciamenti e subentri',
    'Volture luce e gas',
    'Aumenti o diminuzioni di potenza',
    'Risparmio energetico e consulenza tariffe',
  ]
  services.forEach((label, i) => {
    const y = yFromTop(146 + i * 15)
    page.drawCircle({ x: x + 24, y: y + 3, size: 2.5, color: GREEN })
    page.drawText(label, {
      x: x + 32,
      y,
      size: 10,
      font: fonts.regular,
    })
  })

  // 4. Come funziona box (green tint with 3 numbered steps)
  const boxTop = yFromTop(218)
  const boxH = 82
  page.drawRectangle({
    x: x + 16,
    y: boxTop - boxH,
    width: CARD_W - 32,
    height: boxH,
    color: GREEN_BG,
    borderColor: GREEN_BORDER,
    borderWidth: 0.8,
  })
  page.drawText('COME FUNZIONA', {
    x: x + 26,
    y: boxTop - 14,
    size: 7.5,
    font: fonts.bold,
    color: GREEN,
  })
  const steps = [
    { label: 'Segnali il cliente', sub: 'basta una telefonata' },
    { label: 'Gestiamo tutto', sub: 'burocrazia inclusa' },
    { label: 'Ricevi la provvigione', sub: 'a contratto chiuso' },
  ]
  const colWidth = (CARD_W - 32) / 3
  steps.forEach((s, i) => {
    const cx = x + 16 + colWidth * i + colWidth / 2
    // Number circle
    page.drawCircle({ x: cx, y: boxTop - 34, size: 8, color: GREEN })
    const numStr = String(i + 1)
    const numSize = 9
    const numW = fonts.bold.widthOfTextAtSize(numStr, numSize)
    page.drawText(numStr, {
      x: cx - numW / 2,
      y: boxTop - 37,
      size: numSize,
      font: fonts.bold,
      color: WHITE,
    })
    // Label
    const labelSize = 8.5
    const labelW = fonts.bold.widthOfTextAtSize(s.label, labelSize)
    page.drawText(s.label, {
      x: cx - labelW / 2,
      y: boxTop - 54,
      size: labelSize,
      font: fonts.bold,
      color: GREEN_DARK,
    })
    // Sub
    const subSize = 7.5
    const subW = fonts.regular.widthOfTextAtSize(s.sub, subSize)
    page.drawText(s.sub, {
      x: cx - subW / 2,
      y: boxTop - 65,
      size: subSize,
      font: fonts.regular,
      color: GRAY_TEXT,
    })
  })

  // 5. Footer band (gray background, agent + sportello info + QR)
  const footerH = 110
  const footerTop = yFromTop(CARD_H - footerH)
  page.drawRectangle({
    x,
    y: footerTop - footerH,
    width: CARD_W,
    height: footerH,
    color: GRAY_FOOTER,
  })
  page.drawLine({
    start: { x, y: footerTop },
    end: { x: x + CARD_W, y: footerTop },
    thickness: 0.5,
    color: GRAY_LINE,
  })
  // Left column
  page.drawText('IL TUO CONTATTO', {
    x: x + 20,
    y: footerTop - 14,
    size: 6.5,
    font: fonts.bold,
    color: GRAY_LABEL,
  })
  page.drawText(data.agentName, {
    x: x + 20,
    y: footerTop - 27,
    size: 11,
    font: fonts.bold,
  })
  page.drawText('SPORTELLO DI RIFERIMENTO', {
    x: x + 20,
    y: footerTop - 46,
    size: 6.5,
    font: fonts.bold,
    color: GRAY_LABEL,
  })
  page.drawText(data.sportelloName, {
    x: x + 20,
    y: footerTop - 59,
    size: 11,
    font: fonts.bold,
  })
  page.drawText(data.sportelloAddress, {
    x: x + 20,
    y: footerTop - 73,
    size: 9,
    font: fonts.regular,
    color: GRAY_TEXT,
  })
  if (data.sportelloPhone) {
    page.drawText(`Tel. ${data.sportelloPhone}`, {
      x: x + 20,
      y: footerTop - 86,
      size: 9,
      font: fonts.regular,
      color: GRAY_TEXT,
    })
  }
  // Right column: QR code + caption
  const qrPng = await buildQrPng(data.sportelloAddress)
  const qrImg = await doc.embedPng(qrPng)
  const qrSize = 60
  const qrX = x + CARD_W - 20 - qrSize
  const qrY = footerTop - footerH + 22
  page.drawImage(qrImg, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  })
  const captionLabel = 'INDICAZIONI'
  const captionSize = 6.5
  const captionW = fonts.bold.widthOfTextAtSize(captionLabel, captionSize)
  page.drawText(captionLabel, {
    x: qrX + (qrSize - captionW) / 2,
    y: qrY - 10,
    size: captionSize,
    font: fonts.bold,
    color: GRAY_LABEL,
  })
}

async function loadBrandLogo(doc: PDFDocument): Promise<PDFImage | null> {
  // Stored under /public so the file is shipped with the build but isn't
  // exposed as a route (Next.js still serves it statically, but pdf-lib reads
  // it directly off disk on the server).
  const logoPath = path.join(
    process.cwd(),
    'public',
    'LOGO AGENZIA AUTORIZZATA - HERACOMM.png',
  )
  try {
    const bytes = await fs.readFile(logoPath)
    return await doc.embedPng(bytes)
  } catch (e) {
    console.warn('[generateCardPdf] brand logo not found, falling back to placeholder:', e)
    return null
  }
}

export async function generateCardsPdf(cards: CardData[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  const logo = await loadBrandLogo(doc)

  const cardsPerPage = 4
  const pageCount = Math.max(1, Math.ceil(cards.length / cardsPerPage))

  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([A4_W, A4_H])
    const slice = cards.slice(p * cardsPerPage, (p + 1) * cardsPerPage)
    for (let j = 0; j < slice.length; j++) {
      const col = j % 2
      const row = Math.floor(j / 2)
      const cardX = col * CARD_W
      // Row 0 = top row -> topY = A4_H; row 1 = bottom row -> topY = A4_H - CARD_H
      const topY = A4_H - row * CARD_H
      await drawCard(page, doc, { x: cardX, topY }, slice[j], fonts, logo)
    }

    // Crop marks at page center (where the 4 cards meet)
    const cx = A4_W / 2
    const cy = A4_H / 2
    const t = 8
    page.drawLine({
      start: { x: cx, y: cy + 2 },
      end: { x: cx, y: cy + t },
      thickness: 0.5,
      color: GRAY_CROP,
    })
    page.drawLine({
      start: { x: cx, y: cy - 2 },
      end: { x: cx, y: cy - t },
      thickness: 0.5,
      color: GRAY_CROP,
    })
    page.drawLine({
      start: { x: cx + 2, y: cy },
      end: { x: cx + t, y: cy },
      thickness: 0.5,
      color: GRAY_CROP,
    })
    page.drawLine({
      start: { x: cx - 2, y: cy },
      end: { x: cx - t, y: cy },
      thickness: 0.5,
      color: GRAY_CROP,
    })
  }

  return doc.save()
}
