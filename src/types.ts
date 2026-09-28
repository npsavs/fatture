export interface Client {
  id: string
  name: string
  email: string | null
  pec: string | null
  codice_sdi: string | null
  cf_piva: string | null
  phone: string | null
  address: string | null
  city: string | null
  zip: string | null
  province: string | null
}

export interface Invoice {
  id: string
  created_at: string
  invoice_number: string | null
  invoice_date: string
  client_id: string | null
  oggetto: string | null
  notes: string | null
  taxable: number
  vat_rate: number
  sdi_status: string
  email_sent: boolean
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  name: string
  description: string | null
  quantity: number
  unit_price: number
  vat_rate: number
vat_note?: string | null
}