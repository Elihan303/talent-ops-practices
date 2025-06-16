import "reflect-metadata";

// Validation decorator con schema support
function Validate(schema: any) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Validar argumentos contra schema
      for (let i = 0; i < args.length; i++) {
        const result = schema.validate(args[i]);
        if (result.error) {
          throw new ValidationError(
            `Validation failed for parameter ${i}: ${result.error.message}`
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Cache decorator con TTL y key generation
function Cache(options: {
  ttl: number;
  keyGenerator?: (...args: any[]) => string;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { value: any; expiry: number }>();

    descriptor.value = async function (...args: any[]) {
      // Generar cache key
      const key = options.keyGenerator
        ? options.keyGenerator(...args)
        : `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;

      // Verificar cache
      const cached = cache.get(key);
      if (cached && cached.expiry > Date.now()) {
        console.log(`Cache hit for key: ${key}`);
        return cached.value;
      }

      // Ejecutar método original
      const result = await originalMethod.apply(this, args);

      // Guardar en cache
      cache.set(key, {
        value: result,
        expiry: Date.now() + options.ttl * 1000,
      });

      console.log(`Cache miss for key: ${key}, result cached`);
      return result;
    };

    return descriptor;
  };
}

// Logging decorator con performance metrics
function Log(
  options: { level: "debug" | "info" | "warn" | "error" } = { level: "info" }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const className = target.constructor.name;

      console.log(
        `[${options.level.toUpperCase()}] ${className}.${propertyKey} called with args:`,
        args
      );

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        console.log(
          `[${options.level.toUpperCase()}] ${className}.${propertyKey} completed in ${duration}ms`
        );
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(
          `[ERROR] ${className}.${propertyKey} failed after ${duration}ms:`,
          error
        );
        throw error;
      }
    };

    return descriptor;
  };
}

// Retry decorator para resilience
function Retry(options: { attempts: number; delay: number; backoff?: number }) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;

      for (let attempt = 1; attempt <= options.attempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          if (attempt === options.attempts) {
            throw error;
          }

          const delay =
            options.delay * Math.pow(options.backoff || 1, attempt - 1);
          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError!;
    };

    return descriptor;
  };
}

//Transaction decorator
function Transaction() {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    if (!descriptor) return;
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      console.log(`Iniciando transacción para ${String(propertyKey)}`);

      try {
        const result = await originalMethod.apply(this, args);

        console.log(
          `Transaccion ${String(propertyKey)} se completo con exito.`
        );

        return result;
      } catch (error) {
        console.error(`transaccion ${String(propertyKey)} fallo:`, error);

        console.log(`Transaccion ${String(propertyKey)} rolled back.`);

        throw error;
      } finally {
        console.log(`Transaccion ${String(propertyKey)} terminada`);
      }
    };

    return descriptor;
  };
}

// Schema simple para validation
const CreateUserSchema = {
  validate: (data: any) => {
    if (!data || typeof data !== "object") {
      return { error: { message: "Data must be an object" } };
    }

    if (!data.email || typeof data.email !== "string") {
      return { error: { message: "Email is required and must be a string" } };
    }

    if (!data.name || typeof data.name !== "string") {
      return { error: { message: "Name is required and must be a string" } };
    }

    return { error: null };
  },
};

// Service usando decorators
class UserService {
  @Log({ level: "info" })
  @Cache({
    ttl: 300,
    keyGenerator: (email: string) => `user:email:${email}`,
  })
  @Retry({ attempts: 3, delay: 1000, backoff: 2 })
  async findByEmail(email: string): Promise<User | null> {
    // Simular operación que puede fallar
    if (Math.random() < 0.3) {
      throw new Error("Database connection failed");
    }

    // Simular delay de database
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      id: "1",
      email,
      name: "John Doe",
      createdAt: new Date(),
    };
  }

  @Log({ level: "info" })
  @Validate(CreateUserSchema)
  @Cache({ ttl: 600, keyGenerator: () => "users:count" })
  async createUser(userData: { email: string; name: string }): Promise<User> {
    // Business logic puro
    const user: User = {
      id: `user_${Date.now()}`,
      email: userData.email,
      name: userData.name,
      createdAt: new Date(),
    };

    console.log("Creating user:", user);
    return user;
  }

  @Transaction()
  async makeOperation() {
    console.log("Operación en proceso...");
    if (Math.random() < 0.5) {
      throw new Error("Error en la operación");
    }
    console.log("Operación exitosa");
    return "Operación exitosa";
  }
}

// Interfaces
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Uso del service
async function demonstrateDecorators() {
  const userService = new UserService();
  try {
    const transactionResult = await userService.makeOperation();
    console.log("Transaction result:", transactionResult);

    // Test validation
    await userService.createUser({
      email: "john@example.com",
      name: "John Doe",
    });

    // Test caching y retry
    const user = await userService.findByEmail("john@example.com");
    console.log("Found user:", user);

    // Second call should hit cache
    const cachedUser = await userService.findByEmail("john@example.com");
    console.log("Cached user:", cachedUser);
  } catch (error) {
    console.error("Error:", error);
  }
}

demonstrateDecorators();
