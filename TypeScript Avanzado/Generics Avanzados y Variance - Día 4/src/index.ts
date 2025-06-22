// Sistema de data processing con generics avanzados y variance

import { demonstrateEventProcessing } from "./event";

// Base types para demonstration
interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface User extends Entity {
  email: string;
  name: string;
  role: "admin" | "user";
}

interface Product extends Entity {
  name: string;
  price: number;
  category: string;
}

interface Order extends Entity {
  userId: string;
  productIds: string[];
  total: number;
  status: "pending" | "completed" | "cancelled";
}

// Generic processor con variance
interface DataProcessor<T> {
  process(data: T[]): Promise<ProcessingResult<T>>;
  validate(item: T): ValidationResult;
  transform<U>(data: T[], transformer: (item: T) => U): U[];
}

export interface ProcessingResult<T> {
  processed: T[];
  errors: ProcessingError<T>[];
  summary: ProcessingSummary;
}

export interface ProcessingError<T> {
  item: T;
  error: string;
  code: string;
}

interface ProcessingSummary {
  total: number;
  successful: number;
  failed: number;
  duration: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Generic implementation con constraints
class BaseDataProcessor<T extends Entity> implements DataProcessor<T> {
  constructor(
    private validator: (item: T) => ValidationResult,
    private businessRules: BusinessRule<T>[] = []
  ) {}

  async process(data: T[]): Promise<ProcessingResult<T>> {
    const startTime = Date.now();
    const processed: T[] = [];
    const errors: ProcessingError<T>[] = [];

    for (const item of data) {
      try {
        // Validate item
        const validation = this.validate(item);
        if (!validation.isValid) {
          errors.push({
            item,
            error: validation.errors.join(", "),
            code: "VALIDATION_ERROR",
          });
          continue;
        }

        // Apply business rules
        const processedItem = await this.applyBusinessRules(item);
        processed.push(processedItem);
      } catch (error) {
        errors.push({
          item,
          error: (error as Error).message,
          code: "PROCESSING_ERROR",
        });
      }
    }

    const duration = Date.now() - startTime;

    return {
      processed,
      errors,
      summary: {
        total: data.length,
        successful: processed.length,
        failed: errors.length,
        duration,
      },
    };
  }

  validate(item: T): ValidationResult {
    const errors: string[] = [];

    // Basic entity validation
    if (!item.id) errors.push("ID is required");
    if (!item.createdAt) errors.push("Created date is required");
    if (!item.updatedAt) errors.push("Updated date is required");

    // Custom validation
    const customValidation = this.validator(item);
    if (!customValidation.isValid) {
      errors.push(...customValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  transform<U>(data: T[], transformer: (item: T) => U): U[] {
    return data.map(transformer);
  }

  private async applyBusinessRules(item: T): Promise<T> {
    let processedItem = { ...item };

    for (const rule of this.businessRules) {
      processedItem = await rule.apply(processedItem);
    }

    return processedItem;
  }
}

// Business rule interface
interface BusinessRule<T> {
  name: string;
  apply(item: T): Promise<T>;
}

// Specific processors con type safety
class UserProcessor extends BaseDataProcessor<User> {
  constructor() {
    super(
      (user: User) => ({
        isValid: user.email.includes("@") && user.name.length > 0,
        errors: [
          ...(user.email.includes("@") ? [] : ["Invalid email format"]),
          ...(user.name.length > 0 ? [] : ["Name is required"]),
        ],
      }),
      [
        {
          name: "normalizeEmail",
          async apply(user: User): Promise<User> {
            return {
              ...user,
              email: user.email.toLowerCase().trim(),
            };
          },
        },
        {
          name: "updateTimestamp",
          async apply(user: User): Promise<User> {
            return {
              ...user,
              updatedAt: new Date(),
            };
          },
        },
      ]
    );
  }
}

class ProductProcessor extends BaseDataProcessor<Product> {
  constructor() {
    super(
      (product: Product) => ({
        isValid: product.price > 0 && product.name.length > 0,
        errors: [
          ...(product.price > 0 ? [] : ["Price must be positive"]),
          ...(product.name.length > 0 ? [] : ["Name is required"]),
        ],
      }),
      [
        {
          name: "normalizeName",
          async apply(product: Product): Promise<Product> {
            return {
              ...product,
              name: product.name.trim(),
            };
          },
        },
        {
          name: "roundPrice",
          async apply(product: Product): Promise<Product> {
            return {
              ...product,
              price: Math.round(product.price * 100) / 100,
            };
          },
        },
      ]
    );
  }
}

class UserClass {}
class ProductClass {}

// Generic factory con constraints
class ProcessorFactory {
  static createProcessor<T extends Entity>(
    type: new () => T,
    customValidator?: (item: T) => ValidationResult,
    customRules?: BusinessRule<T>[]
  ): DataProcessor<T> {
    if (type === UserClass) {
      return new UserProcessor() as DataProcessor<T>;
    } else if (type === ProductClass) {
      return new ProductProcessor() as DataProcessor<T>;
    } else {
      return new BaseDataProcessor<T>(
        customValidator || (() => ({ isValid: true, errors: [] })),
        customRules || []
      );
    }
  }
}
// Usage con complete type safety
async function demonstrateGenericProcessing() {
  // User processing
  const userProcessor = ProcessorFactory.createProcessor(UserClass);
  const users: User[] = [
    {
      id: "user1",
      email: "JOHN@EXAMPLE.COM",
      name: "John Doe",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user2",
      email: "invalid-email",
      name: "",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const userResult = await userProcessor.process(users);
  console.log("User processing result:", userResult);

  // Product processing
  const productProcessor = ProcessorFactory.createProcessor(ProductClass);
  const products: Product[] = [
    {
      id: "product1",
      name: "  Laptop  ",
      price: 999.999,
      category: "Electronics",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "product2",
      name: "",
      price: -100,
      category: "Invalid",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const productResult = await productProcessor.process(products);
  console.log("Product processing result:", productResult);

  // Generic transformations
  const userSummaries = userProcessor.transform(users, (user) => ({
    id: user.id,
    displayName: user.name,
    isAdmin: user.role === "admin",
  }));

  console.log("User summaries:", userSummaries);
}

demonstrateGenericProcessing().catch((error) => {
  console.error("Error during processing:", error);
});

demonstrateEventProcessing().catch((error) => {
  console.error("Error during event processing:", error);
});
