import { create } from 'zustand'

export interface Sender {
  name: string
  phone: string
}

export interface TripDraft {
  senders: Sender[]
  receiverName: string
  receiverPhone: string
  originCity: string
  destinationCity: string
  goodsDescription: string
  weightKg: string
  freightAmount: string
  goodsValue: string
  invoiceNumber?: string
  invoiceDate?: string
  ewaybillRequired: boolean
  truckId: string
  driverId: string
}

interface TripStore {
  draft: TripDraft
  setDraft: (partialDraft: Partial<TripDraft>) => void
  resetDraft: () => void
}

const initialDraft: TripDraft = {
  senders: [{ name: '', phone: '' }],
  receiverName: '',
  receiverPhone: '',
  originCity: '',
  destinationCity: '',
  goodsDescription: '',
  weightKg: '',
  freightAmount: '',
  goodsValue: '',
  invoiceNumber: '',
  invoiceDate: '',
  ewaybillRequired: false,
  truckId: '',
  driverId: '',
}

export const useTripStore = create<TripStore>((set) => ({
  draft: initialDraft,
  setDraft: (partial) => set((state) => ({ draft: { ...state.draft, ...partial } })),
  resetDraft: () => set({ draft: initialDraft }),
}))
