'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const MESSAGES = {
  en: {
    portalUsers: 'Portal users',
    portalUsersSub:
      'Create main users and assign HR Admin / Manager roles. Employee accounts stay on the Employee portal.',
    overview: 'Overview',
    navUsers: 'Portal users',
    logout: 'Logout',
    assignedUsers: 'Assigned users',
    assignedHint: 'Only Super Admin and HR Admin portal users. Employees are not listed here.',
    createUser: 'Create portal user',
    createHint: 'Assign Admin or Manager — they sign in to the existing HR Admin portal.',
    displayName: 'Display name',
    email: 'Email',
    tempPassword: 'Temporary password',
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
    protected: 'Protected',
    usersPortal: 'Users portal',
    hrAdminPortal: 'HR Admin portal',
    emptyUsers: 'No portal users yet. Create one on the right.',
    language: 'Language',
    loading: 'Loading…',
    createdOk: 'Portal user created. They can sign in to the HR Admin portal with this role.',
    roleUpdated: 'Role updated.',
    deactivated: 'User deactivated.',
    activated: 'User activated.',
    loginTitle: 'Users Portal',
    loginLead: 'Sign in to create portal users and assign HR Admin roles',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    password: 'Password',
  },
  ar: {
    portalUsers: 'مستخدمو البوابة',
    portalUsersSub:
      'إنشاء المستخدمين الرئيسيين وتعيين أدوار مسؤول الموارد البشرية / المدير. حسابات الموظفين تبقى في بوابة الموظف.',
    overview: 'نظرة عامة',
    navUsers: 'مستخدمو البوابة',
    logout: 'تسجيل الخروج',
    assignedUsers: 'المستخدمون المعيّنون',
    assignedHint: 'فقط سوبر أدمن ومستخدمو بوابة مسؤول الموارد البشرية. الموظفون غير مدرجين هنا.',
    createUser: 'إنشاء مستخدم بوابة',
    createHint: 'تعيين مسؤول أو مدير — يسجّلون الدخول إلى بوابة مسؤول الموارد البشرية.',
    displayName: 'الاسم المعروض',
    email: 'البريد الإلكتروني',
    tempPassword: 'كلمة مرور مؤقتة',
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
    protected: 'محمي',
    usersPortal: 'بوابة المستخدمين',
    hrAdminPortal: 'بوابة مسؤول الموارد البشرية',
    emptyUsers: 'لا يوجد مستخدمون بعد. أنشئ واحداً من اليمين.',
    language: 'اللغة',
    loading: 'جاري التحميل…',
    createdOk: 'تم إنشاء المستخدم. يمكنه تسجيل الدخول إلى بوابة المسؤول بهذا الدور.',
    roleUpdated: 'تم تحديث الدور.',
    deactivated: 'تم تعطيل المستخدم.',
    activated: 'تم تفعيل المستخدم.',
    loginTitle: 'بوابة المستخدمين',
    loginLead: 'سجّل الدخول لإنشاء المستخدمين وتعيين أدوار مسؤول الموارد البشرية',
    signIn: 'تسجيل الدخول',
    signingIn: 'جاري الدخول…',
    password: 'كلمة المرور',
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
