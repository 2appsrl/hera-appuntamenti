'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addCampaignEntry(data: {
  userId: string
  month: string
  count: number
  note?: string
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('campaign_entries').insert({
    user_id: data.userId,
    month: data.month,
    count: data.count,
    note: data.note || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/kpi')
}

export async function deleteCampaignEntry(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('campaign_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/kpi')
}
