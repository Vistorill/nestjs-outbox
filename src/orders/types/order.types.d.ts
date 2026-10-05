export type CreateOrderPayload = {
  customerEmail: string;
  amount: number;
};

export type CreateOrderDto = {
  id: string;
  customerEmail: string;
  amount: string;
  createdAt: Date | string | null;
};


