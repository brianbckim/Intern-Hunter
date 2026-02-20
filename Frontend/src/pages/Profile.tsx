import { useEffect, useMemo, useState } from 'react'
import { ApiError, getMyProfile, updateMyProfile, type UserProfileUpdate } from '../lib/api'
import AppLayout from '../components/AppLayout'
import './Dashboard.css'

type ProfileForm = {
  name: string
  major_or_program: string
  career_interests: string
  skills: string[]
  graduation_year: string
}

const EMPTY_FORM: ProfileForm = {
  name: '',
  major_or_program: '',
  career_interests: '',
  skills: [],
  graduation_year: '',
}

function toPayload(form: ProfileForm): UserProfileUpdate {
  const year = form.graduation_year.trim()
  return {
    name: form.name.trim() || null,
    major_or_program: form.major_or_program.trim() || null,
    career_interests: form.career_interests.trim() || null,
    skills: form.skills,
    graduation_year: year ? Number(year) : null,
  }
}

function normalizeFromApi(profile: Awaited<ReturnType<typeof getMyProfile>>): ProfileForm {
  return {
    name: profile.name ?? '',
    major_or_program: profile.major_or_program ?? '',
    career_interests: profile.career_interests ?? '',
    skills: profile.skills ?? [],
    graduation_year: profile.graduation_year ? String(profile.graduation_year) : '',
  }
}

export default function Profile() {
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [originalForm, setOriginalForm] = useState<ProfileForm>(EMPTY_FORM)
  const [skillInput, setSkillInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const profile = await getMyProfile()
        const normalized = normalizeFromApi(profile)
        setForm(normalized)
        setOriginalForm(normalized)
      } catch (errorValue) {
        const message =
          errorValue instanceof ApiError
            ? errorValue.message
            : errorValue instanceof Error
              ? errorValue.message
              : 'Failed to load profile.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(originalForm), [form, originalForm])

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addSkill() {
    const value = skillInput.trim()
    if (!value) return
    if (form.skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) {
      setSkillInput('')
      return
    }

    updateField('skills', [...form.skills, value])
    setSkillInput('')
  }

  function removeSkill(value: string) {
    updateField(
      'skills',
      form.skills.filter((skill) => skill !== value)
    )
  }

  function handleCancel() {
    setForm(originalForm)
    setSkillInput('')
    setSuccess(null)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updated = await updateMyProfile(toPayload(form))
      const normalized = normalizeFromApi(updated)
      setForm(normalized)
      setOriginalForm(normalized)
      window.dispatchEvent(new CustomEvent('internhunter:profile-updated', { detail: updated }))
      setSuccess('Profile saved successfully.')
    } catch (errorValue) {
      const message =
        errorValue instanceof ApiError
          ? errorValue.message
          : errorValue instanceof Error
            ? errorValue.message
            : 'Failed to save profile.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout pageLabel="Profile">
      <div className="ih-grid">
        <section className="ih-card">
          <div className="ih-cardHeader">
            <div className="ih-cardTitle">Profile Form</div>
          </div>
          <div className="ih-cardBody">
            {loading ? <p className="ih-muted">Loading profile...</p> : null}
            {error ? <p className="ih-error">{error}</p> : null}
            {success ? <p className="ih-success">{success}</p> : null}

            {!loading ? (
              <div className="ih-formGrid">
                <label>
                  <span>Name</span>
                  <input className="ih-input" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
                </label>

                <label>
                  <span>Major / Program</span>
                  <input
                    className="ih-input"
                    value={form.major_or_program}
                    onChange={(event) => updateField('major_or_program', event.target.value)}
                  />
                </label>

                <label>
                  <span>Career Interests</span>
                  <input
                    className="ih-input"
                    value={form.career_interests}
                    onChange={(event) => updateField('career_interests', event.target.value)}
                  />
                </label>

                <div>
                  <span>Skills (tags/list)</span>
                  <div className="ih-skillInputRow">
                    <input
                      className="ih-input"
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addSkill()
                        }
                      }}
                      placeholder="Add a skill and press Enter"
                    />
                    <button type="button" className="ih-btnGhost" onClick={addSkill}>
                      Add
                    </button>
                  </div>

                  <div className="ih-skillTags">
                    {form.skills.map((skill) => (
                      <span key={skill} className="ih-skillTag">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <label>
                  <span>Graduation Year</span>
                  <input
                    className="ih-input"
                    type="number"
                    value={form.graduation_year}
                    onChange={(event) => updateField('graduation_year', event.target.value)}
                    placeholder="2028"
                  />
                </label>

                <div className="ih-actions">
                  <button className="ih-btnPrimary" type="button" disabled={!isDirty || saving} onClick={() => void handleSave()}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="ih-btnGhost" type="button" disabled={!isDirty || saving} onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
