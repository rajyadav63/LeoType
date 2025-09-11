'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { words as WORDS } from '../data/words'

const GAME_TIME = 30_000 // 30 seconds
const VISIBLE_WORDS = 200

type LetterState = 'neutral' | 'correct' | 'incorrect'

export default function TypingGame() {
    const [wordList, setWordList] = useState<string[]>(() => {
        const arr: string[] = []
        for (let i = 0; i < VISIBLE_WORDS; i++) {
            arr.push(WORDS[Math.floor(Math.random() * WORDS.length)])
        }
        return arr
    })

    const containerRef = useRef<HTMLDivElement | null>(null)
    const cursorRef = useRef<HTMLDivElement | null>(null)

    const [focused, setFocused] = useState(false)
    const [wordIndex, setWordIndex] = useState(0)
    const [charIndex, setCharIndex] = useState(0)
    const [letterStates, setLetterStates] = useState<Map<number, LetterState[]>>(new Map())

    const [timeLeft, setTimeLeft] = useState(GAME_TIME / 1000)
    const timerRef = useRef<number | null>(null)
    const gameStartRef = useRef<number | null>(null)
    const [running, setRunning] = useState(false)
    const [gameOver, setGameOver] = useState(false)

    // computed WPM
    const wpm = useMemo(() => {
        let correct = 0
        for (let i = 0; i < wordIndex; i++) {
            const word = wordList[i]
            const states = letterStates.get(i) || []
            const incorrect = states.some(s => s === 'incorrect')
            const allCorrect = states.length === word.length && states.every(s => s === 'correct')
            if (!incorrect && allCorrect) correct++
        }
        const minutes = (GAME_TIME - timeLeft * 1000) / 60000
        if (minutes <= 0) return 0
        return Math.round(correct / minutes)
    }, [letterStates, wordIndex, timeLeft, wordList])

    // cleanup timer
    useEffect(() => {
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current)
        }
    }, [])

    // cursor movement
    useEffect(() => {
        const container = containerRef.current
        const cursor = cursorRef.current
        if (!container || !cursor) return

        const currentWordEl = container.querySelectorAll<HTMLDivElement>('.word')[wordIndex]
        if (!currentWordEl) return

        const letters = currentWordEl.querySelectorAll<HTMLSpanElement>('.letter')
        const currentLetterEl = letters[charIndex]

        let targetEl: HTMLElement = currentWordEl
        if (currentLetterEl) targetEl = currentLetterEl

        const rect = targetEl.getBoundingClientRect()
        cursor.style.top = `${rect.top + window.scrollY}px`
        cursor.style.left = `${rect.left}px`
    }, [wordIndex, charIndex])

    // key handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!focused) {
                setFocused(true)
                return
            }
            if (gameOver) return

            if (!running && e.key.length === 1) {
                setRunning(true)
                gameStartRef.current = Date.now()
                timerRef.current = window.setInterval(() => {
                    const elapsed = Date.now() - (gameStartRef.current ?? 0)
                    const remaining = Math.max(0, GAME_TIME - elapsed)
                    setTimeLeft(Math.ceil(remaining / 1000))
                    if (remaining <= 0) {
                        setRunning(false)
                        setGameOver(true)
                        if (timerRef.current) window.clearInterval(timerRef.current)
                    }
                }, 1000)
            }

            if (e.key.length === 1 && e.key !== ' ') {
                setLetterStates(prev => {
                    const copy = new Map(prev)
                    const word = wordList[wordIndex]
                    const states = copy.get(wordIndex) || []
                    const newStates = [...states]

                    if (charIndex < word.length) {
                        newStates[charIndex] = e.key === word[charIndex] ? 'correct' : 'incorrect'
                    } else {
                        newStates.push('incorrect')
                    }

                    copy.set(wordIndex, newStates)
                    return copy
                })
                setCharIndex(c => c + 1)
            }

            if (e.key === ' ') {
                setWordIndex(w => w + 1)
                setCharIndex(0)
            }

            if (e.key === 'Backspace') {
                if (charIndex > 0) {
                    setCharIndex(c => c - 1)
                    setLetterStates(prev => {
                        const copy = new Map(prev)
                        const states = copy.get(wordIndex) || []
                        const newStates = [...states]
                        newStates[charIndex - 1] = 'neutral'
                        copy.set(wordIndex, newStates)
                        return copy
                    })
                }
            }
        }

        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [charIndex, wordIndex, wordList, running, gameOver, focused])

    function resetGame() {
        setWordList(() => {
            const arr: string[] = []
            for (let i = 0; i < VISIBLE_WORDS; i++) {
                arr.push(WORDS[Math.floor(Math.random() * WORDS.length)])
            }
            return arr
        })
        setLetterStates(new Map())
        setWordIndex(0)
        setCharIndex(0)
        setRunning(false)
        setGameOver(false)
        setTimeLeft(GAME_TIME / 1000)
        setFocused(false)
        if (timerRef.current) window.clearInterval(timerRef.current)
    }

    return (
        <main className="h-screen w-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center font-mono">
            <h1 className="text-3xl font-bold text-blue-400 mb-6">LeoType</h1>

            <div className="flex justify-between items-center w-full max-w-3xl px-4 mb-4">
                <div className="text-blue-400">
                    {gameOver ? `WPM: ${wpm}` : `${timeLeft}s`}
                </div>
                <button
                    onClick={resetGame}
                    className="px-4 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                    Restart
                </button>
            </div>

            <div
                ref={containerRef}
                className={`relative p-6 bg-gray-800/50 rounded-lg w-full max-w-3xl h-40 overflow-hidden transition 
        ${focused ? '' : 'blur-sm'}`}
                tabIndex={0}
            >
                <div className="flex flex-wrap text-2xl leading-relaxed">
                    {wordList.map((word, wi) => (
                        <div
                            key={wi}
                            className={`word mr-3 ${wi === wordIndex ? 'underline decoration-blue-400' : ''
                                }`}
                        >
                            {word.split('').map((char, ci) => {
                                const states = letterStates.get(wi) || []
                                const state = states[ci] || 'neutral'
                                return (
                                    <span
                                        key={ci}
                                        className={`letter ${state === 'correct'
                                                ? 'text-gray-200'
                                                : state === 'incorrect'
                                                    ? 'text-red-500'
                                                    : 'text-gray-500'
                                            } ${wi === wordIndex && ci === charIndex ? 'bg-blue-500/40' : ''}`}
                                    >
                                        {char}
                                    </span>
                                )
                            })}
                        </div>
                    ))}
                </div>
                <div
                    ref={cursorRef}
                    id="cursor"
                    className="absolute w-0.5 h-7 bg-blue-400 animate-pulse"
                />
                {!focused && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <span className="bg-gray-900/80 px-4 py-2 rounded">
                            Click here or press any key to focus
                        </span>
                    </div>
                )}
            </div>
        </main>
    )
}
