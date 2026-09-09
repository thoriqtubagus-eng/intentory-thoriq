import Dashboard from "@/pages/Dashboard";
import Items from "@/pages/Items";
import Categories from "@/pages/Categories";
import Suppliers from "@/pages/Suppliers";
import Users from "@/pages/Users";
import IncomingGoods from "@/pages/IncomingGoods";
import OutgoingGoods from "@/pages/OutgoingGoods";
import PurchaseOrders from "@/pages/PurchaseOrders";
import Approvals from "@/pages/Approvals";
import StockMovements from "@/pages/StockMovements";
import Reports from "@/pages/Reports";
import { ROLES } from "@/constants/roles";

export const protectedRoutes = [
  {
    path: "/dashboard",
    element: <Dashboard />,
    roles: [
      ROLES.ADMIN,
      ROLES.WAREHOUSE,
      ROLES.HEAD_OF_WAREHOUSE,
      ROLES.DIVISI
    ],
  },
  {
    path: "/items",
    element: <Items />,
    roles: [
      ROLES.ADMIN,
      ROLES.WAREHOUSE,
      ROLES.HEAD_OF_WAREHOUSE,
      ROLES.DIVISI
    ],
    
  },
  {
    path: "/categories",
    element: <Categories />,
    roles: [ROLES.ADMIN, ROLES.DIVISI],
  },
  {
    path: "/suppliers",
    element: <Suppliers />,
    roles: [ROLES.ADMIN, ROLES.DIVISI],
  },
  {
    path: "/incoming-goods",
    element: <IncomingGoods />,
    roles: [ROLES.ADMIN, ROLES.WAREHOUSE],
  },
  {
    path: "/outgoing-goods",
    element: <OutgoingGoods />,
    roles: [ROLES.ADMIN, ROLES.WAREHOUSE],
  },
  {
    path: "/purchase-orders",
    element: <PurchaseOrders />,
    roles: [ROLES.ADMIN, ROLES.DIVISI],
  },
  {
    path: "/users",
    element: <Users />,
    roles: [ROLES.ADMIN],
  },
  {
    path: "/approvals",
    element: <Approvals />,
    roles: [ROLES.HEAD_OF_WAREHOUSE],
  },
  {
    path: "/stock-movements",
    element: <StockMovements />,
    roles: [
      ROLES.ADMIN,
      ROLES.WAREHOUSE,
      ROLES.HEAD_OF_WAREHOUSE,
    ],
  },
  {
    path: "/reports",
    element: <Reports />,
    roles: [
      ROLES.ADMIN,
      ROLES.WAREHOUSE,
      ROLES.HEAD_OF_WAREHOUSE,
    ],
  },
];
