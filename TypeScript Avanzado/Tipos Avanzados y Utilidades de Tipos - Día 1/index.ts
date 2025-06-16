//Con relacion al selecciona la resputa correcta es la 2 pero no me deja cambiar la opcion.

//EJERCICIO

type PhysicalCategory = `physical_${string}`;
type DigitalCategory = `digital_${string}`;
type ProductCategory = PhysicalCategory | DigitalCategory;

interface BaseProduct {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  description: string;
  inStock: boolean;
  tags: string[];
}

interface PhysicalProduct extends BaseProduct {
  category: PhysicalCategory;
  metadata: {
    weight: number;
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
  };
}

interface DigitalProduct extends BaseProduct {
  category: DigitalCategory;
  metadata: {
    fileSize: number;
    format: string;
  };
}
type Product = PhysicalProduct | DigitalProduct;

function isPhysicalProduct(data: unknown): data is PhysicalProduct {
  return (
    typeof (data as any).category === "string" &&
    (data as any).category.startsWith("physical-") &&
    typeof (data as any).metadata?.weight === "number" &&
    typeof (data as any).metadata?.dimensions?.width === "number" &&
    typeof (data as any).metadata?.dimensions?.height === "number" &&
    typeof (data as any).metadata?.dimensions?.depth === "number"
  );
}

function isDigitalProduct(data: unknown): data is DigitalProduct {
  return (
    typeof (data as any).category === "string" &&
    (data as any).category.startsWith("digital-") &&
    typeof (data as any).metadata?.fileSize === "number" &&
    typeof (data as any).metadata?.format === "string"
  );
}

// Transformaciones declarativas
type CreateProductRequest = Omit<Product, "id">;
type UpdateProductRequest = DeepPartial<Omit<Product, "id">>;
type ProductSummary = Pick<Product, "id" | "name" | "price" | "inStock">;
type ProductSearchResult = Pick<Product, "id" | "name" | "price" | "category">;

// Validation system con conditional types
type ValidationResult<T> = T extends object
  ? { success: true; data: T; errors?: never }
  : { success: false; data?: never; errors: string[] };

// Type guards con utility types
function isValidCreateProduct(data: unknown): data is CreateProductRequest {
  const validation =
    typeof data === "object" &&
    data !== null &&
    typeof (data as any).name === "string" &&
    typeof (data as any).price === "number" &&
    typeof (data as any).category === "string" &&
    typeof (data as any).description === "string" &&
    typeof (data as any).inStock === "boolean" &&
    Array.isArray((data as any).tags) &&
    typeof (data as any).metadata === "object";
  if (!validation) {
    return false;
  }

  return isPhysicalProduct(data) || isDigitalProduct(data);
}

// Service con transformaciones automáticas
class ProductService {
  async createProduct(
    data: unknown
  ): Promise<ValidationResult<Product | null>> {
    if (!isValidCreateProduct(data)) {
      return {
        success: false,
        errors: ["Invalid product data format"],
      };
    }

    const product: Product = {
      id: `product_${Date.now()}`,
      ...data,
    };

    await this.repository.save(product);

    return {
      success: true,
      data: product,
    };
  }

  async updateProduct(
    id: string,
    updates: UpdateProductRequest
  ): Promise<ValidationResult<Product | null>> {
    const existingProduct = await this.repository.findById(id);

    if (!existingProduct) {
      return {
        success: false,
        errors: ["Product not found"],
      };
    }

    // Deep merge con type safety
    const updatedProduct: Product = {
      ...existingProduct,
      ...updates,
      metadata: {
        ...existingProduct.metadata,
        ...updates.metadata,
        dimensions: {
          ...existingProduct.metadata.dimensions,
          ...updates.metadata?.dimensions,
        },
      },
    };

    await this.repository.save(updatedProduct);

    return {
      success: true,
      data: updatedProduct,
    };
  }

  async searchProducts(query: string): Promise<ProductSearchResult[]> {
    const products = await this.repository.search(query);

    // Transformación automática a search result format
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
    }));
  }
}
