// Domain model complejo con union types
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface Product extends BaseEntity {
  type: "product";
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  metadata: {
    weight: number;
    dimensions: { width: number; height: number; depth: number };
    tags: string[];
  };
}

interface Service extends BaseEntity {
  type: "service";
  name: string;
  hourlyRate: number;
  category: string;
  available: boolean;
  metadata: {
    duration: number;
    requirements: string[];
    location: "remote" | "onsite" | "hybrid";
  };
}

interface Subscription extends BaseEntity {
  type: "subscription";
  name: string;
  monthlyPrice: number;
  category: string;
  active: boolean;
  metadata: {
    features: string[];
    limits: { users: number; storage: number };
    billingCycle: "monthly" | "yearly";
  };
}

type CatalogItem = Product | Service | Subscription;

// Sistema de transformaciones usando mapped types y distributive conditional types

// 1. Crear API response types
type ToApiResponse<T extends { id: string }> = T extends { type: infer U }
  ? {
      type: U;
      id: T["id"];
      data: Omit<T, "id" | "type" | "createdAt" | "updatedAt" | "version">;
      meta: {
        createdAt: string;
        updatedAt: string;
        version: number;
      };
    }
  : never;

type CatalogApiResponses = ToApiResponse<CatalogItem>;

// 2. Crear update request types
type ToUpdateRequest<T> = T extends { type: infer U }
  ? {
      type: U;
      updates: Partial<
        Omit<T, "id" | "type" | "createdAt" | "updatedAt" | "version">
      >;
      reason?: string;
    }
  : never;

type CatalogUpdateRequests = ToUpdateRequest<CatalogItem>;

// 3. Mapped type para crear validation schemas
type CreateValidationSchema<T> = {
  [K in keyof T]: T[K] extends string
    ? { type: "string"; required: boolean; pattern?: RegExp }
    : T[K] extends number
    ? { type: "number"; required: boolean; min?: number; max?: number }
    : T[K] extends boolean
    ? { type: "boolean"; required: boolean }
    : T[K] extends Date
    ? { type: "date"; required: boolean }
    : T[K] extends object
    ? {
        type: "object";
        required: boolean;
        schema: CreateValidationSchema<T[K]>;
      }
    : { type: "any"; required: boolean };
};

// 4. Distributive transformation para crear event types
type ToEventType<T> = T extends { type: infer U }
  ? {
      eventType: `${string & U}Changed`;
      entityId: string;
      changes: Partial<
        Omit<T, "id" | "type" | "createdAt" | "updatedAt" | "version">
      >;
      metadata: {
        timestamp: Date;
        userId: string;
        source: string;
      };
    }
  : never;

type CatalogEvents = ToEventType<CatalogItem>;

// 5. Mapped type para crear getters y setters
type CreateAccessors<T> = {
  [K in keyof T as K extends
    | "id"
    | "type"
    | "createdAt"
    | "updatedAt"
    | "version"
    ? never
    : `get${Capitalize<string & K>}`]: () => T[K];
} & {
  [K in keyof T as K extends
    | "id"
    | "type"
    | "createdAt"
    | "updatedAt"
    | "version"
    ? never
    : `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

// 6. Sistema de serialization
type CreateSerializers<T> = {
  [K in keyof T]: T[K] extends Date
    ? (value: T[K]) => string
    : T[K] extends object
    ? (value: T[K]) => Record<string, any>
    : (value: T[K]) => T[K];
};

// 7. Factory para crear instances
class CatalogItemFactory {
  static createProduct(
    data: Omit<Product, "id" | "type" | "createdAt" | "updatedAt" | "version">
  ): Product {
    return {
      id: `product_${Date.now()}`,
      type: "product",
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      ...data,
    };
  }

  static createService(
    data: Omit<Service, "id" | "type" | "createdAt" | "updatedAt" | "version">
  ): Service {
    return {
      id: `service_${Date.now()}`,
      type: "service",
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      ...data,
    };
  }

  static createSubscription(
    data: Omit<
      Subscription,
      "id" | "type" | "createdAt" | "updatedAt" | "version"
    >
  ): Subscription {
    return {
      id: `subscription_${Date.now()}`,
      type: "subscription",
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      ...data,
    };
  }
}

// 8. Type-safe processor que usa distributive conditional types
class CatalogProcessor {
  static processItem<T extends CatalogItem>(item: T): ToApiResponse<T> {
    const { id, type, createdAt, updatedAt, version, ...data } = item;

    return {
      type: type as any,
      id,
      data: data as any,
      meta: {
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        version,
      },
    } as ToApiResponse<T>;
  }

  static createEvent<T extends CatalogItem>(
    item: T,
    changes: Partial<
      Omit<T, "id" | "type" | "createdAt" | "updatedAt" | "version">
    >,
    userId: string
  ): ToEventType<T> {
    return {
      eventType: `${item.type}Changed` as any,
      entityId: item.id,
      changes,
      metadata: {
        timestamp: new Date(),
        userId,
        source: "catalog-service",
      },
    } as ToEventType<T>;
  }
}

// 9. Mapped type para crear validators
type CreateValidators<T> = {
  [K in keyof T]: T[K] extends string
    ? (value: any) => value is string
    : T[K] extends number
    ? (value: any) => value is number
    : T[K] extends boolean
    ? (value: any) => value is boolean
    : T[K] extends Date
    ? (value: any) => value is Date
    : T[K] extends object
    ? (value: any) => value is T[K]
    : (value: any) => boolean;
};
// 10. Validadores para Product
const productValidators: CreateValidators<Product> = {
  id: (value): value is string => typeof value === "string",
  createdAt: (value): value is Date => value instanceof Date,
  updatedAt: (value): value is Date => value instanceof Date,
  version: (value): value is number => typeof value === "number",
  type: (value): value is "product" => value === "product",
  name: (value): value is string => typeof value === "string",
  price: (value): value is number => typeof value === "number",
  category: (value): value is string => typeof value === "string",
  inStock: (value): value is boolean => typeof value === "boolean",
  metadata: (value): value is Product["metadata"] => typeof value === "object",
};

// Uso del sistema
const product = CatalogItemFactory.createProduct({
  name: "Laptop",
  price: 999,
  category: "Electronics",
  inStock: true,
  metadata: {
    weight: 2.5,
    dimensions: { width: 30, height: 20, depth: 2 },
    tags: ["laptop", "computer", "portable"],
  },
});

const apiResponse = CatalogProcessor.processItem(product);
const event2 = CatalogProcessor.createEvent(product, { price: 899 }, "user123");

console.log("API Response:", apiResponse);
console.log("Event:", event2);

// Correcto
console.log("'Laptop' es nombre valido:", productValidators.name("Laptop"));
console.log("999 es un precio valido:", productValidators.price(999));
console.log(
  "true es un valor válido para inStock:",
  productValidators.inStock(true)
);
console.log(" nueva fecha válida:", productValidators.createdAt(new Date()));

// Incorrecto
console.log("123 no es un nombre:", productValidators.name(123));
console.log("'caro' no es un precio:", productValidators.price("caro"));
console.log("'sí' no es booleano:", productValidators.inStock("sí"));
console.log(
  "'2024-01-01' no es instancia Date:",
  productValidators.createdAt("2024-01-01")
);

// Metadata
console.log(
  "Metadata valida:",
  productValidators.metadata({
    weight: 2.5,
    dimensions: { width: 30, height: 20, depth: 2 },
    tags: ["laptop", "tech"],
  })
);
