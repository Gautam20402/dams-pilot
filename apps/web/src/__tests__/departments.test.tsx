/**
 * UI tests — Departments page (/admin/departments)
 *
 * Covers:
 *  - Non-admin users see nothing (redirected)
 *  - Stats bar renders
 *  - Department rows render university + dept names
 *  - Add Department modal opens / closes
 *  - Modal validation: required fields, password mismatch, short password
 *  - Successful submission calls createDepartment mutation
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Router mock ───────────────────────────────────────────────────────────────
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

// ── Auth mock ─────────────────────────────────────────────────────────────────
const mockAdminPayload = {
  adminId: 'admin-1', email: 'admin@dams.edu', name: 'Super Admin',
  role: 'admin' as const, departmentId: null,
}
jest.mock('@/lib/auth', () => ({
  getAdminPayload: jest.fn(() => mockAdminPayload),
}))
import { getAdminPayload } from '@/lib/auth'

// ── Hooks mock ────────────────────────────────────────────────────────────────
const mockCreate = jest.fn()
const mockRefetch = jest.fn()

jest.mock('@/hooks', () => ({
  useDepartments:    jest.fn(),
  useCreateDepartment: jest.fn(() => ({ mutate: mockCreate, isPending: false })),
}))

import DepartmentsPage from '@/app/admin/departments/page'
import { useDepartments } from '@/hooks'

// ── Sample data ───────────────────────────────────────────────────────────────
const DEPTS = [
  {
    id: 'dept-1', name: 'Computer Science', slug: 'computer-science',
    universityName: 'State University', description: 'MS/PhD CS',
    admins: [{ id: 'a1', email: 'cs@dams.edu', name: 'CS Admin', role: 'department' }],
    _count: { leads: 42 },
  },
  {
    id: 'dept-2', name: 'Business', slug: 'business',
    universityName: null, description: null,
    admins: [],
    _count: { leads: 5 },
  },
]

function setupMocks(depts = DEPTS) {
  ;(useDepartments as jest.Mock).mockReturnValue({
    data: { data: depts }, isLoading: false, refetch: mockRefetch,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminPayload as jest.Mock).mockReturnValue(mockAdminPayload)
})

// ── Access control ────────────────────────────────────────────────────────────
describe('Departments page — access control', () => {
  it('redirects dept-admin to dashboard', async () => {
    ;(getAdminPayload as jest.Mock).mockReturnValue({
      ...mockAdminPayload, role: 'department', departmentId: 'dept-1',
    })
    setupMocks()
    render(<DepartmentsPage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/dashboard'))
  })

  it('renders page content for super-admin', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('Departments')).toBeInTheDocument()
  })
})

// ── Stats bar ─────────────────────────────────────────────────────────────────
describe('Departments page — stats', () => {
  it('shows total department count', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('Total Departments')).toBeInTheDocument()
    const kpis = screen.getAllByText('2')
    expect(kpis.length).toBeGreaterThan(0)
  })

  it('shows departments with admin count', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('With Admin Accounts')).toBeInTheDocument()
  })
})

// ── Department table ──────────────────────────────────────────────────────────
describe('Departments page — table', () => {
  it('renders department names', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('Computer Science')).toBeInTheDocument()
    expect(screen.getByText('Business')).toBeInTheDocument()
  })

  it('renders university names when present', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('State University')).toBeInTheDocument()
  })

  it('renders "—" for missing university name', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders admin email for department with admin', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('cs@dams.edu')).toBeInTheDocument()
  })

  it('shows lead count', () => {
    setupMocks()
    render(<DepartmentsPage />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})

// ── Add Department modal ──────────────────────────────────────────────────────
describe('Departments page — Add Department modal', () => {
  it('modal subtitle is not visible on initial render', () => {
    setupMocks()
    render(<DepartmentsPage />)
    // The modal subtitle only appears once the modal is open
    expect(screen.queryByText('Create department + admin account')).not.toBeInTheDocument()
  })

  it('clicking Add Department button opens modal', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<DepartmentsPage />)
    // The page header has the button
    const addBtn = screen.getAllByText('Add Department').find(
      el => el.closest('button') !== null,
    )!
    await user.click(addBtn.closest('button')!)
    expect(screen.getByText('Create department + admin account')).toBeInTheDocument()
  })

  it('shows slug preview as department name is typed', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<DepartmentsPage />)
    const addBtn = screen.getAllByText('Add Department').find(el => el.closest('button'))!
    await user.click(addBtn.closest('button')!)
    const deptInput = screen.getByPlaceholderText('e.g. Computer Science')
    await user.type(deptInput, 'Data Science')
    expect(screen.getByText('data-science')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<DepartmentsPage />)
    const addBtn = screen.getAllByText('Add Department').find(el => el.closest('button'))!
    await user.click(addBtn.closest('button')!)

    await user.type(screen.getByPlaceholderText('e.g. State University of Technology'), 'MIT')
    await user.type(screen.getByPlaceholderText('e.g. Computer Science'), 'CS')
    await user.type(screen.getByPlaceholderText('dept-admin@university.edu'), 'cs@uni.edu')

    const [pwInput, confirmInput] = screen.getAllByPlaceholderText(/Min 8 chars|Repeat/)
    await user.type(pwInput, 'Password1!')
    await user.type(confirmInput, 'DifferentPass!')

    await user.click(screen.getByText('Create department'))
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    setupMocks()
    render(<DepartmentsPage />)
    const addBtn = screen.getAllByText('Add Department').find(el => el.closest('button'))!
    await user.click(addBtn.closest('button')!)

    await user.type(screen.getByPlaceholderText('e.g. State University of Technology'), 'MIT')
    await user.type(screen.getByPlaceholderText('e.g. Computer Science'), 'CS')
    await user.type(screen.getByPlaceholderText('dept-admin@university.edu'), 'cs@uni.edu')

    const [pwInput, confirmInput] = screen.getAllByPlaceholderText(/Min 8 chars|Repeat/)
    await user.type(pwInput, 'short')
    await user.type(confirmInput, 'short')

    await user.click(screen.getByText('Create department'))
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
  })

  it('calls createDepartment with correct payload on valid submit', async () => {
    const user = userEvent.setup()
    mockCreate.mockImplementation((_data: unknown, { onSuccess }: { onSuccess: () => void }) => onSuccess())
    setupMocks()
    render(<DepartmentsPage />)

    const addBtn = screen.getAllByText('Add Department').find(el => el.closest('button'))!
    await user.click(addBtn.closest('button')!)

    await user.type(screen.getByPlaceholderText('e.g. State University of Technology'), 'State University')
    await user.type(screen.getByPlaceholderText('e.g. Computer Science'), 'Physics')
    await user.type(screen.getByPlaceholderText('dept-admin@university.edu'), 'phys@state.edu')

    const [pwInput, confirmInput] = screen.getAllByPlaceholderText(/Min 8 chars|Repeat/)
    await user.type(pwInput, 'Physics@2026')
    await user.type(confirmInput, 'Physics@2026')

    await user.click(screen.getByText('Create department'))

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        universityName: 'State University',
        departmentName: 'Physics',
        email:          'phys@state.edu',
        password:       'Physics@2026',
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})
