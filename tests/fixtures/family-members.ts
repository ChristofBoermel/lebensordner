// Mock family members data for testing
export const mockFamilyMembers = [
  {
    id: 'member-premium-1',
    name: 'Max Mustermann',
    email: 'max@example.com',
    relationship: 'Vater',
    direction: 'incoming' as const,
    linkedAt: '2024-01-01',
    docsCount: 5,
    tier: {
      id: 'premium',
      name: 'Premium',
      color: 'text-purple-600',
      badge: 'bg-purple-100',
      canDownload: true,
      viewOnly: false,
    },
  },
  {
    id: 'member-basic-1',
    name: 'Anna Schmidt',
    email: 'anna@example.com',
    relationship: 'Mutter',
    direction: 'incoming' as const,
    linkedAt: '2024-02-15',
    docsCount: 3,
    tier: {
      id: 'basic',
      name: 'Basis',
      color: 'text-blue-600',
      badge: 'bg-blue-100',
      canDownload: false,
      viewOnly: true,
    },
  },
  {
    id: 'member-free-1',
    name: 'Peter Meier',
    email: 'peter@example.com',
    relationship: 'Bruder',
    direction: 'incoming' as const,
    linkedAt: '2024-03-10',
    docsCount: 0,
    tier: {
      id: 'free',
      name: 'Kostenlos',
      color: 'text-warmgray-600',
      badge: 'bg-warmgray-100',
      canDownload: false,
      viewOnly: false,
    },
  },
  {
    id: 'member-outgoing-1',
    name: 'Lisa Weber',
    email: 'lisa@example.com',
    relationship: 'Schwester',
    direction: 'outgoing' as const,
    linkedAt: '2024-01-20',
    tier: undefined,
  },
]

// Filtered versions for different test scenarios
export const mockPremiumFamilyMembers = mockFamilyMembers.filter(
  m => m.direction === 'incoming' && m.tier?.canDownload
)

export const mockBasicFamilyMembers = mockFamilyMembers.filter(
  m => m.direction === 'incoming' && m.tier?.viewOnly && !m.tier?.canDownload
)

export const mockFreeFamilyMembers = mockFamilyMembers.filter(
  m => m.direction === 'incoming' && !m.tier?.canDownload && !m.tier?.viewOnly
)

export const mockIncomingFamilyMembers = mockFamilyMembers.filter(
  m => m.direction === 'incoming'
)

export const mockOutgoingFamilyMembers = mockFamilyMembers.filter(
  m => m.direction === 'outgoing'
)

// Trusted persons for reminder watcher tests
export const mockTrustedPersonsLinked = [
  {
    id: 'trusted-linked-1',
    name: 'Anna Schmidt',
    email: 'anna@example.com',
    linked_user_id: 'linked-user-1',
  },
  {
    id: 'trusted-linked-2',
    name: 'Max Mustermann',
    email: 'max@example.com',
    linked_user_id: 'linked-user-2',
  },
]

export const mockTrustedPersonsPending = [
  {
    id: 'trusted-pending-1',
    name: 'Pending Person',
    email: 'pending@example.com',
    linked_user_id: null,
  },
]

// Mock documents for document viewer testing
export const mockViewerDocuments = [
  {
    id: 'doc-1',
    title: 'Personalausweis',
    file_name: 'personalausweis.pdf',
    file_path: 'user-1/identitaet/personalausweis.pdf',
    file_type: 'application/pdf',
    file_size: 1024000,
    category: 'identitaet',
    subcategory: null,
    expiry_date: '2030-01-15',
    notes: 'Wichtiges Dokument',
    created_at: '2024-01-01T10:00:00Z',
    streamToken: 'mock-token-1',
  },
  {
    id: 'doc-2',
    title: 'Kontoauszug',
    file_name: 'kontoauszug.pdf',
    file_path: 'user-1/finanzen/kontoauszug.pdf',
    file_type: 'application/pdf',
    file_size: 512000,
    category: 'finanzen',
    subcategory: null,
    expiry_date: null,
    notes: null,
    created_at: '2024-02-01T10:00:00Z',
    streamToken: 'mock-token-2',
  },
]

export const mockViewerCategories = {
  identitaet: 'Identität',
  finanzen: 'Finanzen',
  versicherungen: 'Versicherungen',
  wohnen: 'Wohnen',
  gesundheit: 'Gesundheit',
  vertraege: 'Verträge',
  rente: 'Rente & Pension',
  familie: 'Familie',
  arbeit: 'Arbeit',
  religion: 'Religion',
  sonstige: 'Sonstige',
}
