import type { Language } from '../stores/langStore'

type TranslationKeys =
  | 'appearance'
  | 'themeDesc'
  | 'darkMode'
  | 'darkActive'
  | 'lightActive'
  | 'language'
  | 'languageDesc'
  | 'changePassword'
  | 'updatePassword'
  | 'deleteAccount'
  | 'deleteConfirm'
  | 'deleteButton'
  | 'cancel'

export const translations: Record<Language, Record<TranslationKeys, string>> = {
  en: {
    appearance: 'Appearance',
    themeDesc: 'Switch between light and dark mode.',
    darkMode: 'Dark mode',
    darkActive: 'Dark theme is active',
    lightActive: 'Light theme is active',

    language: 'Language',
    languageDesc: 'Choose your preferred language.',

    changePassword: 'Change Password',
    updatePassword: 'Update Password',

    deleteAccount: 'Delete Account',
    deleteConfirm:
      'Are you sure? All your data (profile, resumes, feedback) will be permanently removed.',
    deleteButton: 'Delete My Account',
    cancel: 'Cancel',
  },

  es: {
    appearance: 'Apariencia',
    themeDesc: 'Cambia entre modo claro y oscuro.',
    darkMode: 'Modo oscuro',
    darkActive: 'El modo oscuro está activo',
    lightActive: 'El modo claro está activo',

    language: 'Idioma',
    languageDesc: 'Elige tu idioma preferido.',

    changePassword: 'Cambiar contraseña',
    updatePassword: 'Actualizar contraseña',

    deleteAccount: 'Eliminar cuenta',
    deleteConfirm:
      '¿Estás seguro? Todos tus datos serán eliminados permanentemente.',
    deleteButton: 'Eliminar mi cuenta',
    cancel: 'Cancelar',
  },

  fr: {
    appearance: 'Apparence',
    themeDesc: 'Basculer entre clair et sombre.',
    darkMode: 'Mode sombre',
    darkActive: 'Le mode sombre est actif',
    lightActive: 'Le mode clair est actif',

    language: 'Langue',
    languageDesc: 'Choisissez votre langue.',

    changePassword: 'Changer le mot de passe',
    updatePassword: 'Mettre à jour le mot de passe',

    deleteAccount: 'Supprimer le compte',
    deleteConfirm:
      'Êtes-vous sûr ? Toutes vos données seront supprimées définitivement.',
    deleteButton: 'Supprimer mon compte',
    cancel: 'Annuler',
  },
}