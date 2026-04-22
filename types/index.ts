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
  sellingPrice: number;
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

export type SaleStatus = "PENDING" | "COMPLETED";

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

export interface DashboardStats {
  todayRevenue: number;
  todaySalesCount: number;
  lowStockCount: number;
  totalProducts: number;
  weeklyRevenue: { date: string; revenue: number }[];
  topProducts: { name: string; sold: number; revenue: number }[];
  recentSales: ISale[];
}

export interface AnalyticsData {
  revenueEvolution: { date: string; revenue: number; sales: number }[];
  productRevenue: { name: string; revenue: number; units: number; margin: number }[];
  categoryDistribution: { name: string; value: number }[];
  topProductsRadar: { product: string; sales: number; revenue: number; stock: number }[];
}
