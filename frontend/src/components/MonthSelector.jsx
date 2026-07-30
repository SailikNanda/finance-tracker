import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function MonthSelector({ month, year, onChange }) {
  const handlePrev = () => {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }

  const handleNext = () => {
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }

  return (
    <div className="month-selector">
      <button className="month-nav" onClick={handlePrev} aria-label="Previous month">
        <ChevronLeftIcon />
      </button>
      <span className="month-display">{MONTHS[month - 1]} {year}</span>
      <button className="month-nav" onClick={handleNext} aria-label="Next month">
        <ChevronRightIcon />
      </button>
    </div>
  )
}

export default MonthSelector
