import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Responsive, Searchable Select Dropdown
 */
export default function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  icon
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const normalizedOptions = useMemo(() => {
    return (options || []).map(opt => {
      if (typeof opt === 'string') return { value: opt, label: opt }
      const optVal = opt.id !== undefined ? opt.id : (opt.value !== undefined ? opt.value : opt.name)
      const optLabel = opt.name || opt.label || String(opt.id || opt.value)
      return {
        value: optVal,
        label: optLabel,
        sublabel: opt.season ? `${opt.season} Season` : (opt.water_efficiency || opt.waterEfficiency ? `${opt.water_efficiency || opt.waterEfficiency} Efficiency` : opt.sublabel),
        badge: opt.water_requirement_class || opt.waterRequirementClass || (opt.water_savings_percentage !== undefined ? `${opt.water_savings_percentage}% savings` : (opt.waterSavingsPercentage !== undefined ? `${opt.waterSavingsPercentage}% savings` : null))
      }
    })
  }, [options])

  const filtered = useMemo(() => {
    if (!search.trim()) return normalizedOptions
    const q = search.toLowerCase()
    return normalizedOptions.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
      (o.badge && o.badge.toLowerCase().includes(q))
    )
  }, [normalizedOptions, search])

  const selectedItem = normalizedOptions.find(
    o => o.value === value || o.label === value || String(o.value) === String(value)
  )

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(item) {
    onChange(item.value, item)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="searchable-select-wrap" ref={containerRef}>
      {label && <label className="select-label">{label}</label>}
      <div
        className={`select-trigger ${open ? 'active' : ''}`}
        tabIndex={0}
        onClick={() => {
          setOpen(prev => {
            if (!prev) setTimeout(() => inputRef.current?.focus(), 50)
            return !prev
          })
        }}
      >
        <div className="select-val">
          {icon && <span className="select-icon">{icon}</span>}
          <span className={selectedItem ? 'val-text' : 'placeholder-text'}>
            {selectedItem ? selectedItem.label : placeholder}
          </span>
        </div>
        <div className="select-arrow">▼</div>
      </div>

      {open && (
        <div className="select-dropdown">
          <div className="select-search-box">
            <input
              ref={inputRef}
              type="text"
              className="select-search-input"
              placeholder={`Search ${label || 'options'}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                className="select-clear-btn"
                onClick={e => {
                  e.stopPropagation()
                  setSearch('')
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div className="select-options-list">
            {filtered.map(item => (
              <div
                key={String(item.value)}
                className={`select-option-item ${(item.value === value || item.label === value || String(item.value) === String(value)) ? 'selected' : ''}`}
                onClick={() => handleSelect(item)}
              >
                <div>
                  <strong className="opt-title">{item.label}</strong>
                  {item.sublabel && <small className="opt-sub">{item.sublabel}</small>}
                </div>
                {item.badge && <span className="opt-badge">{item.badge}</span>}
              </div>
            ))}
            {!filtered.length && (
              <div className="select-no-results">No matching options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
