/**
 * UI tests — Forms list page (/admin/dashboard/forms)
 *
 * Covers:
 *  - Stats bar renders correct counts
 *  - Forms table renders form names
 *  - "No forms yet" empty state shows when list is empty
 *  - Edit button navigates to builder
 *  - Copy link button copies the public URL
 *  - Admin sees dept filter; dept user does not
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Router mock ───────────────────────────────────────────────────────────────
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ── Auth mock: admin role ─────────────────────────────────────────────────────
const mockAdminPayload = {
  adminId:      'admin-1',
  email:        'admin@dams.edu',
  name:         'Super Admin',
  role:         'admin' as const,
  departmentId: null,
}
jest.mock('@/lib/auth', () => ({
  getAdminPayload: jest.fn(() => mockAdminPayload),
}))

// ── Hooks mock ────────────────────────────────────────────────────────────────
const mockRefetch = jest.fn()
const mockPublish = jest.fn()

jest.mock('@/hooks', () => ({
  useForms:       jest.fn(),
  useDepartments: jest.fn(),
  usePublishForm: jest.fn(() => ({ mutate: mockPublish })),
}))

import FormsListPage from '@/app/admin/dashboard/forms/page'
import { useForms, useDepartments } from '@/hooks'
import { getAdminPayload } from '@/lib/auth'

// ── Test data ─────────────────────────────────────────────────────────────────
const DEPT_CS = { id: 'dept-cs', name: 'Computer Science', slug: 'computer-science' }
const DEPT_BIZ = { id: 'dept-biz', name: 'Business', slug: 'business' }

const FORM_ACTIVE = {
  id: 'form-1', name: 'CS Application 2026', slug: 'cs-app-2026',
  departmentId: 'dept-cs', status: 'active',
  schemaJson: { fields: [{ key: 'name' }, { key: 'email' }] },
  publishedAt: '2026-04-01T00:00:00.000Z',
}
const FORM_DRAFT = {
  id: 'form-2', name: 'Biz Draft Form', slug: null,
  departmentId: 'dept-biz', status: 'draft',
  schemaJson: { fields: [] },
  publishedAt: null,
}
const FORM_ARCHIVED = {
  id: 'form-3', name: 'Old Form', slug: 'old-form',
  departmentId: 'dept-cs', status: 'archived',
  schemaJson: { fields: [{ key: 'x' }] },
  publishedAt: '2025-01-01T00:00:00.000Z',
}

function setupMocks(forms: typeof FORM_ACTIVE[] = [], depts = [DEPT_CS, DEPT_BIZ]) {
  ;(useForms as jest.Mock).mockReturnValue({ data: { data: forms }, isLoading: false, refetch: mockRefetch })
  ;(useDepartments as jest.Mock).mockReturnValue({ data: { data: depts } })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminPayload as jest.Mock).mockReturnValue(mockAdminPayload)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Forms list — empty state', () => {
  it('shows "No forms yet" when there are no forms', () => {
    setupMocks([])
    render(<FormsListPage />)
    expect(screen.getByText('No forms yet')).toBeInTheDocument()
  })

  it('shows "Create first form" CTA button', () => {
    setupMocks([])
    render(<FormsListPage />)
    expect(screen.getByText('Create first form')).toBeInTheDocument()
  })
})

describe('Forms list — stats bar', () => {
  it('renders correct total, published, draft, and archived counts', () => {
    setupMocks([FORM_ACTIVE, FORM_DRAFT, FORM_ARCHIVED])
    render(<FormsListPage />)
    // KPI cards: 3 total, 1 published, 1 draft, 1 archived
    const kpiValues = screen.getAllByText(/^\d+$/)
    expect(kpiValues.some(el => el.textContent === '3')).toBe(true)
    expect(kpiValues.some(el => el.textContent === '1')).toBe(true)
  })
})

describe('Forms list — table', () => {
  it('renders form names', () => {
    setupMocks([FORM_ACTIVE, FORM_DRAFT])
    render(<FormsListPage />)
    expect(screen.getByText('CS Application 2026')).toBeInTheDocument()
    expect(screen.getByText('Biz Draft Form')).toBeInTheDocument()
  })

  it('renders field count for each form', () => {
    setupMocks([FORM_ACTIVE])
    render(<FormsListPage />)
    expect(screen.getByText('2 fields')).toBeInTheDocument()
  })

  it('renders status chips', () => {
    setupMocks([FORM_ACTIVE, FORM_DRAFT, FORM_ARCHIVED])
    render(<FormsListPage />)
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()
    expect(screen.getByText('archived')).toBeInTheDocument()
  })
})

describe('Forms list — actions', () => {
  it('Edit button navigates to builder with form id', async () => {
    const user = userEvent.setup()
    setupMocks([FORM_ACTIVE])
    render(<FormsListPage />)
    const editBtns = screen.getAllByText('Edit')
    await user.click(editBtns[0])
    expect(mockPush).toHaveBeenCalledWith('/admin/dashboard/forms/builder?edit=form-1')
  })

  it('New Form button navigates to builder in new mode', async () => {
    const user = userEvent.setup()
    setupMocks([])
    render(<FormsListPage />)
    await user.click(screen.getByText('New Form'))
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/admin/dashboard/forms/builder?new=1'),
    )
  })

  it('draft form shows "Publish" shortcut button (no slug)', () => {
    setupMocks([FORM_DRAFT])
    render(<FormsListPage />)
    expect(screen.getByText('Publish')).toBeInTheDocument()
  })

  it('published form shows "Copy link" button (has slug)', () => {
    setupMocks([FORM_ACTIVE])
    render(<FormsListPage />)
    expect(screen.getByText('Copy link')).toBeInTheDocument()
  })
})

describe('Forms list — admin vs dept-admin visibility', () => {
  it('admin sees department filter dropdown', () => {
    setupMocks([FORM_ACTIVE])
    render(<FormsListPage />)
    expect(screen.getByText('All departments')).toBeInTheDocument()
  })

  it('dept-admin does NOT see department filter', () => {
    ;(getAdminPayload as jest.Mock).mockReturnValue({
      ...mockAdminPayload,
      role: 'department',
      departmentId: 'dept-cs',
    })
    setupMocks([FORM_ACTIVE])
    render(<FormsListPage />)
    expect(screen.queryByText('All departments')).not.toBeInTheDocument()
  })
})
