import {
  AudioLines,
  Cable,
  ChevronRight,
  Disc3,
  ExternalLink,
  Headphones,
  LogOut,
  Pause,
  Play,
  Radio,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  Wallet,
  X,
} from 'lucide-react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { base } from 'wagmi/chains'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isContractConfigured,
  LOOP16_ADDRESS,
  loop16Abi,
} from './config/contract'
import { DATA_SUFFIX } from './config/wagmi'

const SOUNDS = [
  { name: 'KICK', code: 'K', color: '#ff4d38' },
  { name: 'SNARE', code: 'S', color: '#22cdb4' },
  { name: 'HAT', code: 'H', color: '#d9ff43' },
  { name: 'CLAP', code: 'C', color: '#ffd23f' },
] as const

const STEPS = Array.from({ length: 16 }, (_, index) => index)
const EMPTY_PATTERN = Array.from({ length: 64 }, () => 0)
const currentUtcDay = () => BigInt(Math.floor(Date.now() / 86_400_000))

type Profile = {
  totalNotes: bigint
  todayNotes: number
  lastSound: number
  lastStep: number
}

const EMPTY_PROFILE: Profile = {
  totalNotes: 0n,
  todayNotes: 0,
  lastSound: 0,
  lastStep: 0,
}

function asProfile(value: unknown): Profile {
  if (!value) return EMPTY_PROFILE

  if (Array.isArray(value)) {
    return {
      totalNotes: BigInt(value[0] ?? 0),
      todayNotes: Number(value[2] ?? 0),
      lastSound: Number(value[3] ?? 0),
      lastStep: Number(value[4] ?? 0),
    }
  }

  const profile = value as {
    totalNotes?: bigint
    todayNotes?: number
    lastSound?: number
    lastStep?: number
  }

  return {
    totalNotes: BigInt(profile.totalNotes ?? 0),
    todayNotes: Number(profile.todayNotes ?? 0),
    lastSound: Number(profile.lastSound ?? 0),
    lastStep: Number(profile.lastStep ?? 0),
  }
}

function shortAddress(address?: `0x${string}`) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return ''
  const firstLine = error.message.split('\n')[0]
  return firstLine.replace('User rejected the request.', 'Transaction cancelled.')
}

export function App() {
  const [selectedSound, setSelectedSound] = useState(0)
  const [selectedStep, setSelectedStep] = useState(0)
  const [tempo, setTempo] = useState(112)
  const [volume, setVolume] = useState(0.65)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(-1)
  const [walletOpen, setWalletOpen] = useState(false)
  const [connectError, setConnectError] = useState('')
  const audioRef = useRef<AudioContext | null>(null)

  const { address, chainId, isConnected } = useAccount()
  const { connectors, connectAsync, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()

  const profileQuery = useReadContract({
    address: LOOP16_ADDRESS,
    abi: loop16Abi,
    functionName: 'statsOf',
    args: [address!],
    query: {
      enabled: isContractConfigured && Boolean(address),
      refetchInterval: 12_000,
    },
  })

  const patternQuery = useReadContract({
    address: LOOP16_ADDRESS,
    abi: loop16Abi,
    functionName: 'getDayPattern',
    args: [currentUtcDay()],
    query: {
      enabled: isContractConfigured,
      refetchInterval: 12_000,
    },
  })

  const globalNotesQuery = useReadContract({
    address: LOOP16_ADDRESS,
    abi: loop16Abi,
    functionName: 'globalNotes',
    query: {
      enabled: isContractConfigured,
      refetchInterval: 12_000,
    },
  })

  const profile = asProfile(profileQuery.data)
  const pattern = useMemo(() => {
    if (!Array.isArray(patternQuery.data)) return EMPTY_PATTERN
    return patternQuery.data.map((count) => Number(count))
  }, [patternQuery.data])

  const {
    data: hash,
    error: writeError,
    isPending: waitingForWallet,
    reset: resetWrite,
    writeContractAsync,
  } = useWriteContract()

  const {
    error: receiptError,
    isLoading: confirming,
    isSuccess: confirmed,
  } = useWaitForTransactionReceipt({
    hash,
    chainId: base.id,
  })

  useEffect(() => {
    if (!confirmed) return
    void profileQuery.refetch()
    void patternQuery.refetch()
    void globalNotesQuery.refetch()
  }, [confirmed])

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext()
    }
    if (audioRef.current.state === 'suspended') {
      void audioRef.current.resume()
    }
    return audioRef.current
  }, [])

  const playSound = useCallback(
    (sound: number) => {
      const audio = getAudio()
      const now = audio.currentTime
      const master = audio.createGain()
      master.gain.value = volume
      master.connect(audio.destination)

      if (sound === 0) {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(145, now)
        oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.18)
        gain.gain.setValueAtTime(0.95, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
        oscillator.connect(gain)
        gain.connect(master)
        oscillator.start(now)
        oscillator.stop(now + 0.3)
        return
      }

      const buffer = audio.createBuffer(1, audio.sampleRate * 0.25, audio.sampleRate)
      const channel = buffer.getChannelData(0)
      for (let index = 0; index < channel.length; index += 1) {
        channel[index] = Math.random() * 2 - 1
      }

      const source = audio.createBufferSource()
      const filter = audio.createBiquadFilter()
      const gain = audio.createGain()
      source.buffer = buffer

      if (sound === 1) {
        filter.type = 'bandpass'
        filter.frequency.value = 1_800
        gain.gain.setValueAtTime(0.72, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      } else if (sound === 2) {
        filter.type = 'highpass'
        filter.frequency.value = 6_800
        gain.gain.setValueAtTime(0.36, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065)
      } else {
        filter.type = 'bandpass'
        filter.frequency.value = 1_250
        gain.gain.setValueAtTime(0.58, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
      }

      source.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      source.start(now)
      source.stop(now + 0.26)
    },
    [getAudio, volume],
  )

  useEffect(() => {
    if (!isPlaying) return

    const tick = () => {
      setPlayhead((previous) => {
        const next = (previous + 1) % 16
        SOUNDS.forEach((_, soundIndex) => {
          if (pattern[soundIndex * 16 + next] > 0) {
            playSound(soundIndex)
          }
        })
        return next
      })
    }

    tick()
    const interval = window.setInterval(tick, 60_000 / tempo / 4)
    return () => window.clearInterval(interval)
  }, [isPlaying, pattern, playSound, tempo])

  const totalToday = pattern.reduce((sum, value) => sum + value, 0)
  const activeCells = pattern.filter((value) => value > 0).length
  const selectedVotes = pattern[selectedSound * 16 + selectedStep]
  const remaining = Math.max(0, 5 - profile.todayNotes)
  const transactionError = errorMessage(writeError || receiptError)

  const selectSound = (sound: number) => {
    setSelectedSound(sound)
    playSound(sound)
    resetWrite()
  }

  const selectPad = (sound: number, step: number) => {
    setSelectedSound(sound)
    setSelectedStep(step)
    playSound(sound)
    resetWrite()
  }

  const connectWallet = async (connectorIndex: number) => {
    setConnectError('')
    try {
      await connectAsync({ connector: connectors[connectorIndex], chainId: base.id })
      setWalletOpen(false)
    } catch (error) {
      setConnectError(errorMessage(error) || 'Wallet connection failed.')
    }
  }

  const commitNote = async () => {
    if (!isConnected) {
      setWalletOpen(true)
      return
    }
    if (!isContractConfigured || profile.todayNotes >= 5) return

    try {
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id })
      }

      await writeContractAsync({
        address: LOOP16_ADDRESS,
        abi: loop16Abi,
        functionName: 'addNote',
        args: [selectedSound, selectedStep],
        chainId: base.id,
        dataSuffix: DATA_SUFFIX,
      })
    } catch {
      // Wagmi surfaces the useful error through writeError.
    }
  }

  const actionLabel = () => {
    if (!isConnected) return 'CONNECT TO COMMIT'
    if (!isContractConfigured) return 'CONTRACT NOT CONFIGURED'
    if (profile.todayNotes >= 5) return 'DAILY TRACK COMPLETE'
    if (waitingForWallet) return 'CONFIRM IN WALLET'
    if (confirming) return 'PRESSING TO VINYL'
    if (confirmed) return 'NOTE COMMITTED'
    return `COMMIT ${SOUNDS[selectedSound].name} / STEP ${selectedStep + 1}`
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#machine" aria-label="LOOP 16 home">
          <img src="/loop16-mark.svg" alt="" />
          <span>
            <strong>LOOP/16</strong>
            <small>ONCHAIN RHYTHM UNIT</small>
          </span>
        </a>

        <div className="top-status">
          <span className="network-light"><i /> BASE MAINNET</span>
          {isConnected ? (
            <div className="wallet-chip">
              <span>{shortAddress(address)}</span>
              <button type="button" onClick={() => disconnect()} title="Disconnect wallet">
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <button className="connect-button" type="button" onClick={() => setWalletOpen(true)}>
              <Cable size={17} />
              CONNECT
            </button>
          )}
        </div>
      </header>

      {!isContractConfigured && (
        <div className="setup-strip">
          CONTRACT ADDRESS REQUIRED IN <strong>src/config/contract.ts</strong>
        </div>
      )}

      <main id="machine">
        <section className="intro-band">
          <div>
            <span className="eyebrow">DAILY COLLABORATIVE SEQUENCER</span>
            <h1>Build today&apos;s beat.</h1>
          </div>
          <div className="intro-meter">
            <span>YOUR NOTES</span>
            <strong>{profile.todayNotes}<small>/5</small></strong>
            <div className="mini-leds">
              {Array.from({ length: 5 }, (_, index) => (
                <i key={index} className={index < profile.todayNotes ? 'on' : ''} />
              ))}
            </div>
          </div>
        </section>

        <section className="machine">
          <div className="machine-rail">
            <div>
              <span>MODEL</span>
              <strong>L/16-B</strong>
            </div>
            <div className="rail-display">
              <Radio size={16} />
              <span>{isPlaying ? `RUN ${String(playhead + 1).padStart(2, '0')}` : 'READY'}</span>
            </div>
            <div>
              <span>UTC SESSION</span>
              <strong>{currentUtcDay().toString().slice(-5)}</strong>
            </div>
          </div>

          <div className="machine-body">
            <aside className="sound-bank">
              <div className="bank-title">
                <Disc3 size={20} />
                <span>SOUND BANK</span>
              </div>
              {SOUNDS.map((sound, index) => (
                <button
                  key={sound.name}
                  type="button"
                  className={selectedSound === index ? 'sound-key active' : 'sound-key'}
                  style={{ '--sound': sound.color } as React.CSSProperties}
                  onClick={() => selectSound(index)}
                >
                  <span>{sound.code}</span>
                  <strong>{sound.name}</strong>
                  <i />
                </button>
              ))}

              <div className="transport">
                <button
                  type="button"
                  className="transport-main"
                  onClick={() => {
                    getAudio()
                    setIsPlaying((value) => !value)
                  }}
                  title={isPlaying ? 'Pause loop' : 'Play loop'}
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false)
                    setPlayhead(-1)
                  }}
                  title="Reset playhead"
                >
                  <RotateCcw size={19} />
                </button>
              </div>
            </aside>

            <div className="sequencer-panel">
              <div className="panel-header">
                <span><AudioLines size={18} /> TODAY&apos;S SHARED LOOP</span>
                <strong>{totalToday} NOTES / {activeCells} ACTIVE STEPS</strong>
              </div>

              <div className="sequence-scroll">
                <div className="sequence-grid">
                  <div className="step-label empty-label">CH</div>
                  {STEPS.map((step) => (
                    <div key={step} className={playhead === step ? 'step-label playing' : 'step-label'}>
                      {String(step + 1).padStart(2, '0')}
                    </div>
                  ))}

                  {SOUNDS.map((sound, soundIndex) => (
                    <div className="sequence-row" key={sound.name}>
                      <div
                        className="row-label"
                        style={{ '--sound': sound.color } as React.CSSProperties}
                      >
                        {sound.code}
                      </div>
                      {STEPS.map((step) => {
                        const count = pattern[soundIndex * 16 + step]
                        const selected = selectedSound === soundIndex && selectedStep === step
                        return (
                          <button
                            key={step}
                            type="button"
                            className={[
                              'pad',
                              count > 0 ? 'has-note' : '',
                              selected ? 'selected' : '',
                              playhead === step ? 'playing' : '',
                            ].join(' ')}
                            style={{ '--sound': sound.color } as React.CSSProperties}
                            onClick={() => selectPad(soundIndex, step)}
                            aria-label={`${sound.name} step ${step + 1}, ${count} notes`}
                          >
                            <i />
                            {count > 0 && <span>{count}</span>}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="selection-display">
                <span>SELECTED</span>
                <strong>{SOUNDS[selectedSound].name}</strong>
                <b>{String(selectedStep + 1).padStart(2, '0')}</b>
                <small>{selectedVotes} ONCHAIN {selectedVotes === 1 ? 'NOTE' : 'NOTES'}</small>
              </div>
            </div>

            <aside className="mixer-panel">
              <div className="mixer-heading">
                <SlidersHorizontal size={19} />
                <span>MIX</span>
              </div>

              <label className="dial-control">
                <span>TEMPO</span>
                <b>{tempo}</b>
                <input
                  type="range"
                  min="80"
                  max="150"
                  value={tempo}
                  onChange={(event) => setTempo(Number(event.target.value))}
                />
                <small>BPM</small>
              </label>

              <label className="dial-control">
                <span>OUTPUT</span>
                <b>{Math.round(volume * 100)}</b>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
                <small>LEVEL</small>
              </label>

              <div className="output-port">
                <Headphones size={23} />
                <span>WEB AUDIO</span>
                <i />
              </div>
            </aside>
          </div>

          <div className="commit-console">
            <div className="commit-readout">
              <span>QUEUE</span>
              <strong>{SOUNDS[selectedSound].code}-{String(selectedStep + 1).padStart(2, '0')}</strong>
              <small>{remaining} DAILY SLOTS REMAIN</small>
            </div>
            <button
              className="commit-button"
              type="button"
              disabled={
                waitingForWallet ||
                confirming ||
                (isConnected && (!isContractConfigured || profile.todayNotes >= 5))
              }
              onClick={() => void commitNote()}
            >
              <span>{actionLabel()}</span>
              <ChevronRight size={23} />
            </button>
          </div>

          {transactionError && <p className="transaction-error">{transactionError}</p>}

          {confirmed && hash && (
            <div className="receipt-strip">
              <span>NOTE PRESSED ONCHAIN</span>
              <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer">
                VIEW TRANSACTION <ExternalLink size={14} />
              </a>
            </div>
          )}
        </section>

        <section className="telemetry">
          <div className="telemetry-title">
            <span className="eyebrow">SESSION TELEMETRY</span>
            <h2>One loop. Built together.</h2>
          </div>
          <div className="telemetry-values">
            <div>
              <span>YOUR TOTAL</span>
              <strong>{profile.totalNotes.toString()}</strong>
            </div>
            <div>
              <span>TODAY&apos;S LOOP</span>
              <strong>{totalToday}</strong>
            </div>
            <div>
              <span>ALL-TIME NOTES</span>
              <strong>{BigInt(globalNotesQuery.data ?? 0).toString()}</strong>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span>LOOP/16 · BASE MAINNET</span>
        <span>NO TOKEN · NO PRIZE · NETWORK GAS ONLY</span>
      </footer>

      {walletOpen && (
        <div className="modal-backdrop">
          <section className="wallet-modal" aria-modal="true" role="dialog">
            <div className="modal-head">
              <div>
                <span>AUDIO LINK / WALLET</span>
                <h2>Connect player</h2>
              </div>
              <button type="button" onClick={() => setWalletOpen(false)} title="Close">
                <X size={21} />
              </button>
            </div>
            <div className="wallet-list">
              {connectors.map((connector, index) => (
                <button
                  key={connector.uid}
                  type="button"
                  disabled={connecting}
                  onClick={() => void connectWallet(index)}
                >
                  <span>{index === 0 ? <Disc3 size={22} /> : <Wallet size={22} />}</span>
                  <span>
                    <strong>{index === 0 ? 'Base Account' : 'Browser Wallet'}</strong>
                    <small>{index === 0 ? 'Base app and Smart Wallet' : 'MetaMask, Rabby or injected wallet'}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
              {connectError && <p className="connect-error">{connectError}</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
