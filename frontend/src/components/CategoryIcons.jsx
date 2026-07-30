import React from 'react'

const ICON = {
  width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round',
}

export const FoodIcon = () => (
  <svg {...ICON}>
    <path d="M3 2v7c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V2" />
    <path d="M5 2v20" />
    <path d="M19 2c-1.66 0-3 1.34-3 3v6c0 1.1.9 2 2 2h0v9" />
    <line x1="17" y1="2" x2="19" y2="2" />
  </svg>
)

export const TransportIcon = () => (
  <svg {...ICON}>
    <path d="M5 17h14M5 17a2 2 0 0 1-2-2V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7a2 2 0 0 1-2 2M5 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M17 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2" />
    <circle cx="7.5" cy="13" r="1" fill="currentColor" />
    <circle cx="16.5" cy="13" r="1" fill="currentColor" />
  </svg>
)

export const ShoppingIcon = () => (
  <svg {...ICON}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
)

export const EntertainmentIcon = () => (
  <svg {...ICON}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <polyline points="17 2 12 7 7 2" />
    <circle cx="7.5" cy="13" r="1" fill="currentColor" />
    <circle cx="12" cy="13" r="1" fill="currentColor" />
    <circle cx="16.5" cy="13" r="1" fill="currentColor" />
  </svg>
)

export const BillsIcon = () => (
  <svg {...ICON}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

export const HealthIcon = () => (
  <svg {...ICON}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    <path d="M3.5 12h4l1.5-3 3 6 1.5-3h7" stroke="#fff" strokeWidth="1.4" />
  </svg>
)

export const EducationIcon = () => (
  <svg {...ICON}>
    <path d="M22 10v6" />
    <path d="M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
  </svg>
)

export const TravelIcon = () => (
  <svg {...ICON}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
)

export const SparkleIcon = () => (
  <svg {...ICON}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const SalaryIcon = () => (
  <svg {...ICON}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)

export const FreelanceIcon = () => (
  <svg {...ICON}>
    <rect x="2" y="4" width="20" height="14" rx="2" />
    <path d="M2 20h20" />
    <path d="M8 10l-2 2 2 2" />
    <path d="M16 10l2 2-2 2" />
    <path d="M13 8l-2 8" />
  </svg>
)

export const BusinessIcon = () => (
  <svg {...ICON}>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="14 7 21 7 21 14" />
  </svg>
)

export const InvestmentIcon = () => (
  <svg {...ICON}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </svg>
)

export const GiftIcon = () => (
  <svg {...ICON}>
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
)

export const HousingIcon = () => (
  <svg {...ICON}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

export const GroceriesIcon = () => (
  <svg {...ICON}>
    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
    <path d="M21 9a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3" />
    <path d="M12 2a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4Z" />
  </svg>
)

export const SubscriptionsIcon = () => (
  <svg {...ICON}>
    <rect x="2" y="3" width="20" height="15" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

export const TaxesIcon = () => (
  <svg {...ICON}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

export const RefundsIcon = () => (
  <svg {...ICON}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
)

export const DividendsIcon = () => (
  <svg {...ICON}>
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
)

export const ShieldIcon = () => (
  <svg {...ICON}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

export const HeartIcon = () => (
  <svg {...ICON}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

export const BriefcaseIcon = () => (
  <svg {...ICON}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
)

export const UserIcon = () => (
  <svg {...ICON}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export const TagIcon = () => (
  <svg {...ICON}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
)

export const CATEGORY_ICONS = {
  food: FoodIcon,
  transport: TransportIcon,
  shopping: ShoppingIcon,
  entertainment: EntertainmentIcon,
  bills: BillsIcon,
  health: HealthIcon,
  education: EducationIcon,
  travel: TravelIcon,
  housing: HousingIcon,
  groceries: GroceriesIcon,
  subscriptions: SubscriptionsIcon,
  taxes: TaxesIcon,
  personal: UserIcon,
  insurance: ShieldIcon,
  gifts_don: HeartIcon,
  invest_exp: InvestmentIcon,
  work_exp: BriefcaseIcon,
  other_exp: SparkleIcon,
  salary: SalaryIcon,
  freelance: FreelanceIcon,
  business: BusinessIcon,
  investment: InvestmentIcon,
  gift: GiftIcon,
  rental: HousingIcon,
  refunds: RefundsIcon,
  dividends: DividendsIcon,
  side_hustle: FreelanceIcon,
  sales: BusinessIcon,
  grants: GiftIcon,
  pension: SalaryIcon,
  other_inc: SparkleIcon,
  custom: TagIcon,
}