// translations.ts
export type Language = 'en' | 'es' | 'fr'
export type TranslationKeys =
  | 'appearance'
  | 'themeDesc'
  | 'darkMode'
  | 'darkActive'
  | 'lightActive'
  | 'language'
  | 'languageDesc'
  | 'currentPassword'
  | 'currentPasswordPlaceholder'
  | 'newPassword'
  | 'newPasswordPlaceholder'
  | 'confirmNewPassword'
  | 'confirmNewPasswordPlaceholder'
  | 'fillAllFields'
  | 'passwordsMismatch'
  | 'passwordNotConnected'
  | 'changePassword'
  | 'updatePassword'
  | 'deleteAccount'
  | 'deleteConfirm'
  | 'deleteButton'
  | 'cancel'
  | 'deleting'
  | 'deleteFailed'

export const translations: Record<Language, Record<TranslationKeys, string>> = {
  en: {
    appearance: 'Appearance',
    themeDesc: 'Switch between light and dark mode.',
    darkMode: 'Dark mode',
    darkActive: 'Dark theme is active',
    lightActive: 'Light theme is active',

    language: 'Language',
    languageDesc: 'Choose your preferred language.',

    currentPassword: 'Current Password',
    currentPasswordPlaceholder: 'Enter current password',
    newPassword: 'New Password',
    newPasswordPlaceholder: 'Enter new password',
    confirmNewPassword: 'Confirm New Password',
    confirmNewPasswordPlaceholder: 'Confirm new password',
    fillAllFields: 'Please fill in all fields.',
    passwordsMismatch: 'New passwords do not match.',
    passwordNotConnected: 'Password change is not connected to the backend yet.',

    changePassword: 'Change Password',
    updatePassword: 'Update Password',

    deleteAccount: 'Delete Account',
    deleteConfirm:
      'Are you sure? All your data (profile, resumes, feedback) will be permanently removed.',
    deleteButton: 'Delete My Account',
    cancel: 'Cancel',
    deleting: 'Deleting…',
    deleteFailed: 'Failed to delete account.',
  },

  es: {
    appearance: 'Apariencia',
    themeDesc: 'Cambia entre modo claro y oscuro.',
    darkMode: 'Modo oscuro',
    darkActive: 'El modo oscuro está activo',
    lightActive: 'El modo claro está activo',

    language: 'Idioma',
    languageDesc: 'Elige tu idioma preferido.',

    currentPassword: 'Contraseña actual',
    currentPasswordPlaceholder: 'Introduce la contraseña actual',
    newPassword: 'Nueva contraseña',
    newPasswordPlaceholder: 'Introduce la nueva contraseña',
    confirmNewPassword: 'Confirmar nueva contraseña',
    confirmNewPasswordPlaceholder: 'Confirma la nueva contraseña',
    fillAllFields: 'Por favor, completa todos los campos.',
    passwordsMismatch: 'Las nuevas contraseñas no coinciden.',
    passwordNotConnected: 'El cambio de contraseña no está conectado al backend aún.',

    changePassword: 'Cambiar contraseña',
    updatePassword: 'Actualizar contraseña',

    deleteAccount: 'Eliminar cuenta',
    deleteConfirm:
      '¿Estás seguro? Todos tus datos (perfil, currículums, comentarios) se eliminarán permanentemente.',
    deleteButton: 'Eliminar mi cuenta',
    cancel: 'Cancelar',
    deleting: 'Eliminando…',
    deleteFailed: 'Error al eliminar la cuenta.',
  },

  fr: {
    appearance: 'Apparence',
    themeDesc: 'Basculer entre clair et sombre.',
    darkMode: 'Mode sombre',
    darkActive: 'Le mode sombre est actif',
    lightActive: 'Le mode clair est actif',

    language: 'Langue',
    languageDesc: 'Choisissez votre langue.',

    currentPassword: 'Mot de passe actuel',
    currentPasswordPlaceholder: 'Entrez le mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    newPasswordPlaceholder: 'Entrez le nouveau mot de passe',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    confirmNewPasswordPlaceholder: 'Confirmez le nouveau mot de passe',
    fillAllFields: 'Veuillez remplir tous les champs.',
    passwordsMismatch: 'Les nouveaux mots de passe ne correspondent pas.',
    passwordNotConnected: "Le changement de mot de passe n'est pas encore connecté au backend.",

    changePassword: 'Changer le mot de passe',
    updatePassword: 'Mettre à jour le mot de passe',

    deleteAccount: 'Supprimer le compte',
    deleteConfirm:
      'Êtes-vous sûr ? Toutes vos données (profil, CV, retours) seront supprimées définitivement.',
    deleteButton: 'Supprimer mon compte',
    cancel: 'Annuler',
    deleting: 'Suppression…',
    deleteFailed: "Échec de la suppression du compte.",
  },
}