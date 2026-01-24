import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, AuthState } from '../types'
import * as api from '../services/api'

interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<boolean>
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: true,
    })

    // Check for existing session on mount
    useEffect(() => {
        const token = localStorage.getItem('vms_token')
        const userStr = localStorage.getItem('vms_user')

        if (token && userStr) {
            try {
                const user = JSON.parse(userStr) as User
                setState({
                    user,
                    token,
                    isAuthenticated: true,
                    isLoading: false,
                })
            } catch {
                localStorage.removeItem('vms_token')
                localStorage.removeItem('vms_user')
                setState((s) => ({ ...s, isLoading: false }))
            }
        } else {
            setState((s) => ({ ...s, isLoading: false }))
        }
    }, [])

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        setState((s) => ({ ...s, isLoading: true }))

        try {
            const result = await api.login(email, password)

            if (result && result.accessToken && result.user) {
                localStorage.setItem('vms_token', result.accessToken)
                localStorage.setItem('vms_user', JSON.stringify(result.user))

                setState({
                    user: result.user,
                    token: result.accessToken,
                    isAuthenticated: true,
                    isLoading: false,
                })
                return true
            }
        } catch (err) {
            console.error('Login failed:', err)
        }

        setState((s) => ({ ...s, isLoading: false }))
        return false
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('vms_token')
        localStorage.removeItem('vms_user')
        localStorage.removeItem('vms_refresh_token')

        setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
        })
    }, [])

    return (
        <AuthContext.Provider value={{ ...state, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
