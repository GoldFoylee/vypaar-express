import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'

interface AppState {
  session: Session | null
  user: User | null
  tenantId: string | null
  setSession: (session: Session | null) => void
  setTenantId: (id: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  session: null,
  user: null,
  tenantId: null,
  setSession: (session) => set({ session, user: session?.user || null }),
  setTenantId: (tenantId) => set({ tenantId }),
}))
