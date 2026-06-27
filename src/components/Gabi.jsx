import { useEffect, useRef } from 'react'

export default function Gabi({ size = 56 }) {
  const ref = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      if (ref.current) ref.current.src = `/GABBY.gif?t=${Date.now()}`
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <img
      ref={ref}
      src="/GABBY.gif"
      alt="Gabi"
      width={size}
      height={size}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}
