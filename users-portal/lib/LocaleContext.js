'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const MESSAGES = {
  en: {
    portalUsers: 'Portal users',
    portalUsersSub: 'Create users and assign roles for the HR Admin portal.',
    overview: 'Overview',
    navUsers: 'Portal users',
    logout: 'Logout',
    assignedUsers: 'Assigned users',
    assignedHint: 'Only Super Admin and HR Admin portal users. Employees are not listed here.',
    createUser: 'Create portal user',
    displayName: 'Display name',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    createAssign: 'Create & assign role',
    creating: 'Creating…',
    user: 'User',
    portalAccess: 'Portal access',
    status: 'Status',
    actions: 'Actions',
    active: 'Active',
    off: 'Off',
    deactivate: 'Deactivate',
    activate: 'Activate',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save changes',
    cancel: 'Cancel',
    protected: 'Protected',
    usersPortal: 'Users portal',
    hrAdminPortal: 'HR Admin portal',
    emptyUsers: 'No portal users yet. Create one below.',
    language: 'Language',
    loading: 'Loading…',
    createdOk: 'User created successfully and role assigned.',
    roleUpdated: 'Role updated successfully.',
    userUpdated: 'User updated successfully.',
    deactivated: 'User deactivated successfully.',
    activated: 'User activated successfully.',
    deleted: 'User deleted successfully.',
    confirmDeactivate: 'Deactivate this user? They will not be able to sign in until activated again.',
    confirmActivate: 'Activate this user again?',
    confirmDelete: 'Delete this user permanently? This cannot be undone.',
    editUser: 'Edit user',
    newPasswordOptional: 'New password (optional)',
    loginTitle: 'Users Portal',
    loginLead: 'Sign in to create portal users and assign roles',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
  },
  ar: {
    portalUsers: 'مستخدمو البوابة',
    portalUsersSub: 'إنشاء المستخدمين وتعيين الأدوار لبوابة مسؤول الموارد البشرية.',
    overview: 'نظرة عامة',
    navUsers: 'مستخدمو البوابة',
    logout: 'تسجيل الخروج',
    assignedUsers: 'المستخدمون المعيّنون',
    assignedHint: 'فقط سوبر أدمن ومستخدمو بوابة مسؤول الموارد البشرية. الموظفون غير مدرجين هنا.',
    createUser: 'إنشاء مستخدم بوابة',
    displayName: 'الاسم المعروض',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    role: 'الدور',
    createAssign: 'إنشاء وتعيين الدور',
    creating: 'جاري الإنشاء…',
    user: 'المستخدم',
    portalAccess: 'وصول البوابة',
    status: 'الحالة',
    actions: 'إجراءات',
    active: 'نشط',
    off: 'متوقف',
    deactivate: 'تعطيل',
    activate: 'تفعيل',
    edit: 'تعديل',
    delete: 'حذف',
    save: 'حفظ التغييرات',
    cancel: 'إلغاء',
    protected: 'محمي',
    usersPortal: 'بوابة المستخدمين',
    hrAdminPortal: 'بوابة مسؤول الموارد البشرية',
    emptyUsers: 'لا يوجد مستخدمون بعد. أنشئ واحداً أدناه.',
    language: 'اللغة',
    loading: 'جاري التحميل…',
    createdOk: 'تم إنشاء المستخدم وتعيين الدور بنجاح.',
    roleUpdated: 'تم تحديث الدور بنجاح.',
    userUpdated: 'تم تحديث المستخدم بنجاح.',
    deactivated: 'تم تعطيل المستخدم بنجاح.',
    activated: 'تم تفعيل المستخدم بنجاح.',
    deleted: 'تم حذف المستخدم بنجاح.',
    confirmDeactivate: 'تعطيل هذا المستخدم؟ لن يتمكن من تسجيل الدخول حتى يتم تفعيله مرة أخرى.',
    confirmActivate: 'تفعيل هذا المستخدم مرة أخرى؟',
    confirmDelete: 'حذف هذا المستخدم نهائياً؟ لا يمكن التراجع عن ذلك.',
    editUser: 'تعديل المستخدم',
    newPasswordOptional: 'كلمة مرور جديدة (اختياري)',
    loginTitle: 'بوابة المستخدمين',
    loginLead: 'سجّل الدخول لإنشاء المستخدمين وتعيين الأدوار',
    signIn: 'تسجيل الدخول',
    signingIn: 'جاري الدخول…',
  },
};

const LocaleContext = createContext({
  locale: 'en',
  t: (k) => k,
  toggleLocale: () => {},
});

const STORAGE_KEY = 'users_portal_locale';

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') setLocaleState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute('data-locale', locale);
  }, [locale]);

  const setLocale = useCallback((next) => {
    const loc = next === 'ar' ? 'ar' : 'en';
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const t = useCallback(
    (key) => {
      const table = MESSAGES[locale] || MESSAGES.en;
      return table[key] || MESSAGES.en[key] || key;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, t, toggleLocale }), [locale, t, toggleLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
