import { create } from 'zustand'

export interface Sender {
  name: string
  phone: string
  gst?: string
}

export interface Receiver {
  name: string
  phone: string
  gst?: string
}

export interface TripDraft {
  senders: Sender[]
  receivers: Receiver[]
  origin: string
  destination: string
  goods_description: string
  quantity: number | null
  quantity_unit: string
  weight_kg: string
  freight_amount: string
  goods_value: string
  ewaybill_required: boolean
  truck_id: string
  driver_id: string
}

interface TripStore {
  draft: TripDraft
  setDraft: (partialDraft: Partial<TripDraft>) => void
  resetDraft: () => void
  setSenders: (senders: Sender[]) => void
  setReceivers: (receivers: Receiver[]) => void
  setGoodsDescription: (value: string) => void
  setQuantity: (value: number | null) => void
  setQuantityUnit: (value: string) => void
  setWeightKg: (value: number | null) => void
  setFreightAmount: (value: number | null) => void
  setGoodsValue: (value: number | null) => void
  setOrigin: (value: string) => void
  setDestination: (value: string) => void
}

const initialDraft: TripDraft = {
  senders: [{ name: '', phone: '' }],
  receivers: [{ name: '', phone: '' }],
  origin: '',
  destination: '',
  goods_description: '',
  quantity: null,
  quantity_unit: 'Pieces',
  weight_kg: '',
  freight_amount: '',
  goods_value: '',
  ewaybill_required: false,
  truck_id: '',
  driver_id: '',
}

export const useTripStore = create<TripStore>((set) => ({
  draft: initialDraft,
  setDraft: (partial) => set((state) => ({ draft: { ...state.draft, ...partial } })),
  resetDraft: () => set({ draft: initialDraft }),
  setSenders: (senders) => set((state) => ({ draft: { ...state.draft, senders } })),
  setReceivers: (receivers) => set((state) => ({ draft: { ...state.draft, receivers } })),
  setGoodsDescription: (value) => set((state) => ({ draft: { ...state.draft, goods_description: value } })),
  setQuantity: (value) => set((state) => ({ draft: { ...state.draft, quantity: value } })),
  setQuantityUnit: (value) => set((state) => ({ draft: { ...state.draft, quantity_unit: value } })),
  setWeightKg: (value) => set((state) => ({ draft: { ...state.draft, weight_kg: value !== null ? value.toString() : '' } })),
  setFreightAmount: (value) => set((state) => ({ draft: { ...state.draft, freight_amount: value !== null ? value.toString() : '' } })),
  setGoodsValue: (value) => set((state) => ({ draft: { ...state.draft, goods_value: value !== null ? value.toString() : '' } })),
  setOrigin: (value) => set((state) => ({ draft: { ...state.draft, origin: value } })),
  setDestination: (value) => set((state) => ({ draft: { ...state.draft, destination: value } })),
}))
