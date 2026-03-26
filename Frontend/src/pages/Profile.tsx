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
            <div className="ih-cardTitle">Your Profile</div>
            <p className="ih-muted">Keep your info up to date for better internship matches.</p>
          </div>

          <div className="ih-cardBody">
            {loading ? <p className="ih-muted">Loading profile…</p> : null}

            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                {success}
              </div>
            ) : null}

            {!loading ? (
              <div className="mt-2 grid max-w-2xl gap-5">
                {/* Name */}
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Name</span>
                  <input
                    className="ih-input"
                    placeholder="e.g. Jane Doe"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </label>

                {/* Major / Program */}
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Major / Program</span>
                  <input
                    className="ih-input"
                    placeholder="e.g. Computer Science"
                    value={form.major_or_program}
                    onChange={(e) => updateField('major_or_program', e.target.value)}
                  />
                </label>

                {/* Career Interests */}
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Career Interests</span>
                  <input
                    className="ih-input"
                    placeholder="e.g. Full-stack development, Machine learning"
                    value={form.career_interests}
                    onChange={(e) => updateField('career_interests', e.target.value)}
                  />
                </label>

                {/* Skills — chip / tag system */}
                <div className="grid gap-1.5">
                  <span className="text-sm font-semibold">Skills</span>

                  <div className="flex gap-2">
                    <input
                      className="ih-input"
                      placeholder="Type a skill and press Enter"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addSkill()
                        }
                      }}
                    />
                    <button type="button" className="ih-btnGhost shrink-0" onClick={addSkill}>
                      Add
                    </button>
                  </div>

                  {form.skills.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {form.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
                          style={{
                            background: 'var(--pill-bg)',
                            borderColor: 'var(--pill-border)',
                            color: 'var(--pill-text)',
                          }}
                        >
                          {skill}
                          <button
                            type="button"
                            className="ml-0.5 cursor-pointer text-base leading-none opacity-60 hover:opacity-100"
                            style={{ background: 'none', border: 'none', color: 'inherit', padding: 0 }}
                            onClick={() => removeSkill(skill)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="ih-muted mt-1">No skills added yet.</p>
                  )}
                </div>

                {/* Graduation Year */}
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Graduation Year</span>
                  <input
                    className="ih-input"
                    type="number"
                    placeholder="e.g. 2028"
                    value={form.graduation_year}
                    onChange={(e) => updateField('graduation_year', e.target.value)}
                  />
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    className="ih-btnPrimary"
                    type="button"
                    disabled={!isDirty || saving}
                    onClick={() => void handleSave()}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    className="ih-btnGhost"
                    type="button"
                    disabled={!isDirty || saving}
                    onClick={handleCancel}
                  >
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
