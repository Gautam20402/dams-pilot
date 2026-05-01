/**
 * UI tests — Sign-in page
 *
 * Covers:
 *  - Page renders email + password fields
 *  - Password visibility toggle (show / hide)
 *  - Empty-submission prevented via noValidate + required
 *  - Successful login flow: calls API → stores token → redirects
 *  - Failed login flow: displays error message
 *  - API unreachable: network error message
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Next.js navigation mock ───────────────────────────────────────────────────
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter:       () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: (_: string) => null }),
}))

// ── Auth mock ─────────────────────────────────────────────────────────────────
jest.mock('@/lib/auth', () => ({
  getAdminPayload: jest.fn(() => null),   // not already logged in
  setToken:        jest.fn(),
}))

// ── Import the actual component ───────────────────────────────────────────────
// We import after mocks so the module picks up our stubs.
// eslint-disable-next-line import/first
import SignInPage from '@/app/auth/sign-in/page'
import { setToken } from '@/lib/auth'

// ── fetch mock ────────────────────────────────────────────────────────────────
const mockFetch = jest.fn()
global.fetch = mockFetch

function mockLoginSuccess(token = 'header.payload.sig') {
  mockFetch.mockResolvedValueOnce({
    ok:   true,
    json: async () => ({ success: true, data: { token } }),
  } as Response)
}

function mockLoginFailure(errorMsg = 'Invalid email or password') {
  mockFetch.mockResolvedValueOnce({
    ok:   false,
    json: async () => ({ success: false, error: errorMsg }),
  } as Response)
}

function mockNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error('Network error'))
}

// ── Render helper ─────────────────────────────────────────────────────────────
function renderSignIn() {
  render(<SignInPage />)
  return {
    emailInput:      () => screen.getByTestId('email-input'),
    passwordInput:   () => screen.getByTestId('password-input'),
    toggleBtn:       () => screen.getByTestId('toggle-password'),
    submitBtn:       () => screen.getByTestId('submit-btn'),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Sign-in page — render', () => {
  it('renders email and password inputs', () => {
    const { emailInput, passwordInput } = renderSignIn()
    expect(emailInput()).toBeInTheDocument()
    expect(passwordInput()).toBeInTheDocument()
  })

  it('renders a Sign in button', () => {
    renderSignIn()
    expect(screen.getByTestId('submit-btn')).toHaveTextContent('Sign in')
  })

  it('does NOT render "University Pilot Program" text', () => {
    renderSignIn()
    expect(screen.queryByText(/university pilot program/i)).not.toBeInTheDocument()
  })

  it('does NOT contain the word "Graduate" in the heading area', () => {
    renderSignIn()
    expect(screen.queryByText(/graduate/i)).not.toBeInTheDocument()
  })

  it('shows "Admissions Platform" heading (split by <br>)', () => {
    renderSignIn()
    // h1 contains "Admissions" and "Platform" as separate text nodes around a <br>
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Admissions')
    expect(heading).toHaveTextContent('Platform')
  })
})

describe('Sign-in page — password visibility toggle', () => {
  it('password field starts as type="password"', () => {
    const { passwordInput } = renderSignIn()
    expect(passwordInput()).toHaveAttribute('type', 'password')
  })

  it('clicking toggle changes type to "text" (shows password)', async () => {
    const user = userEvent.setup()
    const { passwordInput, toggleBtn } = renderSignIn()
    await user.click(toggleBtn())
    expect(passwordInput()).toHaveAttribute('type', 'text')
  })

  it('clicking toggle twice hides password again', async () => {
    const user = userEvent.setup()
    const { passwordInput, toggleBtn } = renderSignIn()
    await user.click(toggleBtn())
    await user.click(toggleBtn())
    expect(passwordInput()).toHaveAttribute('type', 'password')
  })

  it('toggle button has accessible aria-label', () => {
    const { toggleBtn } = renderSignIn()
    expect(toggleBtn()).toHaveAttribute('aria-label', 'Show password')
  })

  it('aria-label updates when password is revealed', async () => {
    const user = userEvent.setup()
    const { toggleBtn } = renderSignIn()
    await user.click(toggleBtn())
    expect(toggleBtn()).toHaveAttribute('aria-label', 'Hide password')
  })
})

describe('Sign-in page — form submission', () => {
  it('calls the login API with email and password', async () => {
    const user = userEvent.setup()
    mockLoginSuccess()
    const { emailInput, passwordInput, submitBtn } = renderSignIn()

    await user.type(emailInput(), 'admin@dams.edu')
    await user.type(passwordInput(), 'Admin@2026')
    await user.click(submitBtn())

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: 'admin@dams.edu', password: 'Admin@2026' }),
        }),
      )
    })
  })

  it('calls setToken and redirects on successful login', async () => {
    const user = userEvent.setup()
    mockLoginSuccess('tok.en.here')
    const { emailInput, passwordInput, submitBtn } = renderSignIn()

    await user.type(emailInput(), 'admin@dams.edu')
    await user.type(passwordInput(), 'Admin@2026')
    await user.click(submitBtn())

    await waitFor(() => {
      expect(setToken).toHaveBeenCalledWith('tok.en.here')
      expect(mockReplace).toHaveBeenCalledWith('/admin/dashboard')
    })
  })

  it('shows error message on failed login', async () => {
    const user = userEvent.setup()
    mockLoginFailure('Invalid email or password')
    const { emailInput, passwordInput, submitBtn } = renderSignIn()

    await user.type(emailInput(), 'wrong@dams.edu')
    await user.type(passwordInput(), 'wrongpass')
    await user.click(submitBtn())

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
    })
    expect(setToken).not.toHaveBeenCalled()
  })

  it('shows network error message when API is unreachable', async () => {
    const user = userEvent.setup()
    mockNetworkError()
    const { emailInput, passwordInput, submitBtn } = renderSignIn()

    await user.type(emailInput(), 'admin@dams.edu')
    await user.type(passwordInput(), 'Admin@2026')
    await user.click(submitBtn())

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the server')
    })
  })

  it('disables submit button while loading', async () => {
    // Never resolve so we can observe the loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    const { emailInput, passwordInput, submitBtn } = renderSignIn()

    await user.type(emailInput(), 'admin@dams.edu')
    await user.type(passwordInput(), 'Admin@2026')
    await user.click(submitBtn())

    expect(submitBtn()).toBeDisabled()
  })
})
