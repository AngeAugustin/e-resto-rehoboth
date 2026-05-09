export type UserRole = "directeur" | "gerant";

export interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface IProduct {
  _id: string;
  name: string;
  category?: string;
  image?: string;
  /** Prix de vente unitaire marché (fiche produit) */
  marketSellingPrice: number;
  /** Unités par casier standard (fiche & import) */
  quantiteStandardPack?: number;
  /** Prix du casier en FCFA (fiche & import) */
  prixCasier?: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface ISupply {
  _id: string;
  product: IProduct | string;
  lotSize: number;
  lotPrice: number;
  numberOfLots: number;
  marketSellingPrice: number;
  totalUnits: number;
  totalCost: number;
  createdBy: IUser | string;
  createdAt: string;
  updatedAt: string;
}

export interface ISaleItem {
  product: IProduct | string;
  quantity: number;
  unitPrice: number;
  /** Coût unitaire d’achat (dernier appro), absent sur les anciennes ventes */
  unitCost?: number;
  total: number;
}

export type SaleStatus = "PENDING" | "COMPLETED" | "CANCELLED";

/** Renseigné à la clôture de la vente */
export type SalePaymentMethod = "CASH" | "MOBILE_MONEY";

export interface ISale {
  _id: string;
  waitress: IWaitress | string;
  /** Tables associées (au moins une) */
  tables?: (IRestaurantTable | string)[];
  /** Anciennes ventes enregistrées avec une seule table */
  table?: IRestaurantTable | string;
  items: ISaleItem[];
  totalAmount: number;
  amountPaid?: number;
  change?: number;
  /**
   * Si monnaie à rendre : `true` = remise au client à la clôture ; `false` = pas encore remise (mention sur le ticket,
   * délai de récupération).
   */
  changeReturnedAck?: boolean;
  /** Présent pour les ventes clôturées après ajout du champ (anciennes ventes peuvent ne pas l’avoir) */
  paymentMethod?: SalePaymentMethod;
  status: SaleStatus;
  createdBy: IUser | string;
  createdAt: string;
  updatedAt: string;
}

export interface IWaitress {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IRestaurantTable {
  _id: string;
  number: number;
  name?: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
  /** Renseigné par GET /api/tables : id de la vente en attente sur cette table, sinon null */
  occupiedByPendingSaleId?: string | null;
}

export type CashSessionStatus = "OPEN" | "CLOSED";

export interface ICashSession {
  _id: string;
  name: string;
  sessionDate: string;
  openingFloat: number;
  /** Renseigné à la clôture : fond de caisse repris ou non */
  openingFloatRecovered?: boolean;
  status: CashSessionStatus;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  todayRevenue: number;
  todaySalesCount: number;
  lowStockCount: number;
  totalProducts: number;
  weeklyRevenue: { date: string; revenue: number }[];
  topProducts: { name: string; sold: number; revenue: number }[];
  lowStockProducts: { id: string; name: string; image?: string; stock: number; marketSellingPrice: number }[];
  recentSales: ISale[];
}

export interface AnalyticsData {
  period: {
    filter: "today" | "yesterday" | "week" | "month" | "semester" | "year" | "custom";
    startDate: string;
    endDate: string;
    label: string;
  };
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalGrossProfit: number;
    totalSales: number;
    marginRate: number;
    averageTicket: number;
    revenueDeltaPct: number;
    profitDeltaPct: number;
  };
  revenueEvolution: {
    date: string;
    revenue: number;
    cost: number;
    grossProfit: number;
    marginRate: number;
    sales: number;
  }[];
  productRevenue: {
    name: string;
    image?: string;
    price: number;
    revenue: number;
    units: number;
    margin: number;
  }[];
  categoryDistribution: { name: string; value: number }[];
  topProductsRadar: { product: string; sales: number; revenue: number; stock: number }[];
}
