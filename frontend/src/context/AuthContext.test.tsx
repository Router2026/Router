import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

// Mock the api module
vi.mock('../api', () => ({
  api: {
    auth: {
      login: vi.fn(),
      register: vi.fn(),
      me: vi.fn(),
    },
  },
}))

import { api } from '../api'

const mockApi = api as unknown as {
  auth: {
    login: ReturnType<typeof vi.fn>
    register: ReturnType<typeof vi.fn>
    me: ReturnType<typeof vi.fn>
  }
}

function TestConsumer() {
  const auth = useAuth()
  return (
    <div>
      <div data-testid="isLoggedIn">{String(auth.isLoggedIn)}</div>
      <div data-testid="isLoading">{String(auth.isLoading)}</div>
      <div data-testid="isGuest">{String(auth.isGuest)}</div>
      <div data-testid="user">{auth.user ? auth.user.username : 'null'}</div>
      <button onClick={() => auth.login('test@test.com', 'pass')}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
      <button onClick={() => auth.loginWithToken('tok')}>loginWithToken</button>
      <button onClick={() => auth.loginAsGuest()}>loginAsGuest</button>
      <button onClick={() => auth.upgradeGuest()}>upgradeGuest</button>
    </div>
  )
}

const mockUser = {
  id: '1', email: 'test@test.com', username: 'testuser',
  xp_points: 0, level: 'מטייל מתחיל',
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('AuthContext', () => {
  it('starts with isLoggedIn=false and isLoading=false when no stored token', async () => {
    mockApi.auth.me.mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false')
    })
    expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  it('restores session from localStorage on mount', async () => {
    localStorage.setItem('router_auth_token', 'stored-token')
    mockApi.auth.me.mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
    })
    expect(screen.getByTestId('user').textContent).toBe('testuser')
  })

  it('clears token when session restore fails', async () => {
    localStorage.setItem('router_auth_token', 'bad-token')
    mockApi.auth.me.mockRejectedValue(new Error('invalid token'))
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('isLoading').textContent).toBe('false')
    })
    expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
    expect(localStorage.getItem('router_auth_token')).toBeNull()
  })

  it('login sets isLoggedIn=true and stores token', async () => {
    mockApi.auth.me.mockResolvedValue(mockUser)
    mockApi.auth.login.mockResolvedValue({ user: mockUser, token: 'new-token' })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'))

    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => {
      expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
    })
    expect(localStorage.getItem('router_auth_token')).toBe('new-token')
  })

  it('logout clears session and localStorage', async () => {
    localStorage.setItem('router_auth_token', 'stored-token')
    mockApi.auth.me.mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('isLoggedIn').textContent).toBe('true'))

    act(() => {
      screen.getByText('logout').click()
    })
    expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
    expect(localStorage.getItem('router_auth_token')).toBeNull()
  })

  it('loginWithToken sets user from token', async () => {
    mockApi.auth.me.mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'))

    await act(async () => {
      screen.getByText('loginWithToken').click()
    })
    await waitFor(() => {
      expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
    })
    expect(localStorage.getItem('router_auth_token')).toBe('tok')
  })

  it('loginAsGuest sets isGuest=true and stores GUEST_KEY', async () => {
    mockApi.auth.me.mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'))

    act(() => { screen.getByText('loginAsGuest').click() })
    expect(screen.getByTestId('isGuest').textContent).toBe('true')
    expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('אורח')
    expect(localStorage.getItem('router_guest_mode')).toBe('true')
  })

  it('restores guest session from localStorage on mount', async () => {
    localStorage.setItem('router_guest_mode', 'true')
    mockApi.auth.me.mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'))
    expect(screen.getByTestId('isGuest').textContent).toBe('true')
    expect(screen.getByTestId('user').textContent).toBe('אורח')
  })

  it('upgradeGuest clears guest state', async () => {
    localStorage.setItem('router_guest_mode', 'true')
    mockApi.auth.me.mockResolvedValue(mockUser)
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('isGuest').textContent).toBe('true'))

    act(() => { screen.getByText('upgradeGuest').click() })
    expect(screen.getByTestId('isGuest').textContent).toBe('false')
    expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('null')
    expect(localStorage.getItem('router_guest_mode')).toBeNull()
  })

  it('token restore failure falls back to guest when GUEST_KEY is set', async () => {
    localStorage.setItem('router_auth_token', 'bad-token')
    localStorage.setItem('router_guest_mode', 'true')
    mockApi.auth.me.mockRejectedValue(new Error('invalid token'))
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'))
    expect(screen.getByTestId('isGuest').textContent).toBe('true')
    expect(screen.getByTestId('user').textContent).toBe('אורח')
  })
})
