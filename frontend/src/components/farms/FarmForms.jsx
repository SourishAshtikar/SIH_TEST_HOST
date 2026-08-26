import { useState } from 'react'
import { Droplets, Leaf, Sprout } from 'lucide-react'
import { Modal, Form } from '../common/CommonUI'
import SearchableSelect from '../common/SearchableSelect'

export function FarmForm({ onClose, onSubmit }) {
  return (
    <Modal title="Add farm" onClose={onClose}>
      <Form onSubmit={onSubmit} submit="Create farm">
        <label>
          Farm name
          <input name="name" required />
        </label>
        <label>
          Owner name
          <input name="owner_name" />
        </label>
        <label>
          Total land area (hectares)
          <input name="total_land_area_hectares" type="number" min="0.01" step="0.01" required />
        </label>
      </Form>
    </Modal>
  )
}

export function RecordForm({ onClose, onSubmit, lookups }) {
  const [seasonId, setSeasonId] = useState(lookups?.seasons?.[0]?.id || '')
  const [cropId, setCropId] = useState(lookups?.crops?.[0]?.id || '')
  const [methodId, setMethodId] = useState(lookups?.methods?.[0]?.id || '')
  const [agriculturalYear, setAgriculturalYear] = useState(new Date().getFullYear().toString())
  const [cultivatedArea, setCultivatedArea] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSubmit({
      season_id: seasonId,
      crop_id: cropId,
      agricultural_year: agriculturalYear,
      cultivated_area_hectares: cultivatedArea,
      current_irrigation_method_id: methodId
    })
    setBusy(false)
  }

  return (
    <Modal title="Add seasonal crop record" onClose={onClose}>
      <form className="stack" onSubmit={handleSubmit}>
        <SearchableSelect
          label="Season"
          value={seasonId}
          onChange={setSeasonId}
          options={lookups.seasons}
          placeholder="Search and select season..."
          icon={<Leaf />}
        />

        <SearchableSelect
          label="Crop"
          value={cropId}
          onChange={setCropId}
          options={lookups.crops}
          placeholder="Search crop by name, season, water demand..."
          icon={<Sprout />}
        />

        <label>
          Agricultural year
          <input
            name="agricultural_year"
            value={agriculturalYear}
            onChange={e => setAgriculturalYear(e.target.value)}
            placeholder="e.g. 2026 or 2026-2027"
            required
          />
        </label>

        <label>
          Cultivated area (hectares)
          <input
            name="cultivated_area_hectares"
            type="number"
            min="0.01"
            step="0.01"
            value={cultivatedArea}
            onChange={e => setCultivatedArea(e.target.value)}
            placeholder="e.g. 5.5"
            required
          />
        </label>

        <SearchableSelect
          label="Current irrigation method"
          value={methodId}
          onChange={setMethodId}
          options={lookups.methods}
          placeholder="Search irrigation method..."
          icon={<Droplets />}
        />

        <button className="button primary" disabled={busy} style={{ marginTop: '10px' }}>
          {busy ? 'Adding record…' : 'Add seasonal record'}
        </button>
      </form>
    </Modal>
  )
}
