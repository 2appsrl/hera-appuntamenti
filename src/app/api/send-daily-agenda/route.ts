import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const DAY_NAMES = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato']

const RECIPIENTS = [
  'sem.ronzoni@rangeritaly.it',
  'luce.giacalone@rangeritaly.it',
  'bruno.parisi@rangeritaly.it',
]

interface AppointmentRow {
  id: string
  client_name: string
  client_surname: string
  client_phone: string
  appointment_date: string
  appointment_time: string
  location: string
  notes: string | null
  agents: { name: string; type: string } | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 2) + '..'
}

async function generatePDF(appointments: AppointmentRow[], dateStr: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const margin = 40
  const contentWidth = pageWidth - margin * 2

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Title
  page.drawText('Agenda Appuntamenti', { x: margin, y, font: boldFont, size: 18, color: rgb(0.12, 0.16, 0.21) })
  y -= 24
  page.drawText(formatDate(dateStr), { x: margin, y, font, size: 13, color: rgb(0.39, 0.45, 0.53) })
  y -= 12
  page.drawText(`${appointments.length} appuntament${appointments.length === 1 ? 'o' : 'i'}`, { x: margin, y, font, size: 11, color: rgb(0.39, 0.45, 0.53) })
  y -= 30

  if (appointments.length === 0) {
    page.drawText('Nessun appuntamento per questa data.', { x: margin, y, font, size: 12, color: rgb(0.58, 0.64, 0.70) })
    return doc.save()
  }

  // Group by agent
  const grouped = new Map<string, AppointmentRow[]>()
  appointments.forEach(a => {
    const key = a.agents?.name || 'Senza agente'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(a)
  })

  // Column widths
  const colWidths = [42, 140, 85, 120, contentWidth - 42 - 140 - 85 - 120]
  const rowHeight = 18
  const headerLabels = ['Ora', 'Cliente', 'Telefono', 'Luogo', 'Note']
  const colMaxChars = [5, 22, 14, 18, 20]

  function checkNewPage() {
    if (y < margin + 40) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  for (const [agentName, agentAppointments] of grouped) {
    checkNewPage()
    const agentType = agentAppointments[0]?.agents?.type === 'sportello' ? 'Sportello' : 'Agente'

    // Agent header
    page.drawText(`${agentType}: ${agentName}`, { x: margin, y, font: boldFont, size: 12, color: rgb(0.12, 0.16, 0.21) })
    y -= 20

    checkNewPage()

    // Table header background
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0.15, 0.39, 0.92),
    })

    // Table header text
    let x = margin
    headerLabels.forEach((label, i) => {
      page.drawText(label, { x: x + 4, y: y, font: boldFont, size: 8, color: rgb(1, 1, 1) })
      x += colWidths[i]
    })
    y -= rowHeight + 2

    // Table rows
    agentAppointments
      .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
      .forEach((apt, idx) => {
        checkNewPage()

        // Alternate row background
        if (idx % 2 === 0) {
          page.drawRectangle({
            x: margin,
            y: y - 4,
            width: contentWidth,
            height: rowHeight,
            color: rgb(0.97, 0.98, 0.99),
          })
        }

        x = margin
        const rowData = [
          apt.appointment_time?.slice(0, 5) || '',
          `${apt.client_name} ${apt.client_surname}`,
          apt.client_phone,
          apt.location,
          apt.notes || '',
        ]

        rowData.forEach((cell, i) => {
          page.drawText(truncate(cell, colMaxChars[i]), { x: x + 4, y, font, size: 8, color: rgb(0.12, 0.16, 0.21) })
          x += colWidths[i]
        })

        y -= rowHeight
      })

    y -= 15
  }

  // Footer on last page
  page.drawText(
    `Generato da Hera Appuntamenti - ${new Date().toLocaleString('it-IT')}`,
    { x: margin, y: margin - 10, font, size: 7, color: rgb(0.58, 0.64, 0.70) }
  )

  return doc.save()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const overrideDate = searchParams.get('date')
  const isTest = searchParams.get('test') === '1'

  try {
    let targetDate: string
    if (overrideDate) {
      targetDate = overrideDate
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      targetDate = tomorrow.toISOString().split('T')[0]
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select('*, agents(name, type)')
      .eq('appointment_date', targetDate)
      .order('appointment_time')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const pdfBytes = await generatePDF(appointments || [], targetDate)

    const resend = new Resend(process.env.RESEND_API_KEY)

    const recipients = isTest ? ['semronzoni.2app@gmail.com'] : RECIPIENTS

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Hera Appuntamenti <noreply@rangeritaly.it>',
      to: recipients,
      subject: `Agenda Appuntamenti - ${formatDate(targetDate)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Agenda Appuntamenti</h2>
          <p style="color: #64748b;">${formatDate(targetDate)} - ${(appointments || []).length} appuntament${(appointments || []).length === 1 ? 'o' : 'i'}</p>
          <p style="color: #64748b; font-size: 14px;">In allegato il PDF con l'agenda completa degli appuntamenti.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Hera Appuntamenti</p>
        </div>
      `,
      attachments: [
        {
          filename: `agenda-${targetDate}.pdf`,
          content: Buffer.from(pdfBytes).toString('base64'),
        },
      ],
    })

    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      date: targetDate,
      appointments: (appointments || []).length,
      emailId: emailData?.id,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
