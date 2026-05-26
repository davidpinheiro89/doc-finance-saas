'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'

export interface OnboardingProfile {
  especialidade: string
  valor_medio_plantao: string
  plantoes_por_mes: string
}

export interface UseOnboardingResult {
  showOnboarding: boolean
  step: number
  setStep: (s: number) => void
  saveProfile: (profile: OnboardingProfile) => Promise<void>
  completeOnboarding: () => Promise<void>
  skipOnboarding: () => Promise<void>
}

export function useOnboarding(user: User | null): UseOnboardingResult {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [step, setStep] = useState(1)

  useEffect(() => {
    if (!user) return

    const check = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) {
        // No row yet — create one and show onboarding
        await supabase.from('user_settings').upsert({
          user_id: user.id,
          onboarding_completed: false,
        }, { onConflict: 'user_id' })
        setShowOnboarding(true)
      } else if (data.onboarding_completed === false) {
        setShowOnboarding(true)
      }
    }

    check()
  }, [user])

  const markComplete = useCallback(async () => {
    if (!user) return
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    setShowOnboarding(false)
  }, [user])

  const saveProfile = useCallback(async (profile: OnboardingProfile) => {
    if (!user) return
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        especialidade: profile.especialidade || null,
        valor_medio_plantao: profile.valor_medio_plantao ? parseFloat(profile.valor_medio_plantao) : null,
        plantoes_por_mes: profile.plantoes_por_mes || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
  }, [user])

  return {
    showOnboarding,
    step,
    setStep,
    saveProfile,
    completeOnboarding: markComplete,
    skipOnboarding: markComplete,
  }
}
