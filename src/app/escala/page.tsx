'use client'

import React from 'react'
import Sidebar from '../../components/Sidebar'

export default function EscalaPage() {
  // Mock user for now - we'll add real auth later
  const mockUser = { 
    id: 'mock-user-id',
    name: 'Usuário Teste',
    email: 'test@example.com'
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={mockUser} />
      
      <div className="flex-1 overflow-auto">
        <div className='p-6'>
          <h1 className="text-2xl font-bold mb-6 text-gray-800">NOVA ESCALA LIMPA</h1>
          <p className="text-gray-600">Sidebar carregada com sucesso! Conteúdo principal visível.</p>
        </div>
      </div>
    </div>
  )
}
