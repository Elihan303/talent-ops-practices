import { ProcessingError, ProcessingResult, ValidationResult } from ".";

// 1. Jerarquía de eventos
interface BaseEvent {
  id: string;
  timestamp: Date;
  type: string;
}

interface UserCreatedEvent extends BaseEvent {
  type: "user_created";
  userId: string;
  email: string;
}

interface ProductPurchasedEvent extends BaseEvent {
  type: "product_purchased";
  userId: string;
  productId: string;
  amount: number;
}

// 2. Procesador genérico de eventos
class EventProcessor<TEvent extends BaseEvent> {
  constructor(
    private validator: (event: TEvent) => ValidationResult,
    private handlers: EventHandler<TEvent>[] = []
  ) {}

  async process(events: TEvent[]): Promise<ProcessingResult<TEvent>> {
    const startTime = Date.now();
    const processed: TEvent[] = [];
    const errors: ProcessingError<TEvent>[] = [];

    for (const event of events) {
      const validation = this.validator(event);
      if (!validation.isValid) {
        errors.push({
          item: event,
          error: validation.errors.join(", "),
          code: "VALIDATION_ERROR",
        });
        continue;
      }
      let handledEvent = { ...event };
      for (const handler of this.handlers) {
        handledEvent = await handler.handle(handledEvent);
      }
      processed.push(handledEvent);
    }

    const duration = Date.now() - startTime;
    return {
      processed,
      errors,
      summary: {
        total: events.length,
        successful: processed.length,
        failed: errors.length,
        duration,
      },
    };
  }
}

interface EventHandler<TEvent extends BaseEvent> {
  handle(event: TEvent): Promise<TEvent>;
}

// 3. Procesadores específicos de eventos
class UserCreatedEventProcessor extends EventProcessor<UserCreatedEvent> {
  constructor() {
    super(
      (event) => ({
        isValid: !!event.userId && !!event.email,
        errors: [
          ...(!event.userId ? ["userId is required"] : []),
          ...(!event.email ? ["email is required"] : []),
        ],
      }),
      [
        {
          async handle(event) {
            return { ...event, email: event.email.toLowerCase() };
          },
        },
      ]
    );
  }
}

class ProductPurchasedEventProcessor extends EventProcessor<ProductPurchasedEvent> {
  constructor() {
    super(
      (event) => ({
        isValid: !!event.userId && !!event.productId && event.amount > 0,
        errors: [
          ...(!event.userId ? ["userId is required"] : []),
          ...(!event.productId ? ["productId is required"] : []),
          ...(event.amount > 0 ? [] : ["amount must be positive"]),
        ],
      }),
      []
    );
  }
}

export async function demonstrateEventProcessing() {
  const userEvents: UserCreatedEvent[] = [
    {
      id: "e1",
      timestamp: new Date(),
      type: "user_created",
      userId: "user1",
      email: "NEW@MAIL.COM",
    },
    {
      id: "e2",
      timestamp: new Date(),
      type: "user_created",
      userId: "",
      email: "",
    },
  ];

  const productEvents: ProductPurchasedEvent[] = [
    {
      id: "e3",
      timestamp: new Date(),
      type: "product_purchased",
      userId: "user1",
      productId: "product1",
      amount: 2,
    },
    {
      id: "e4",
      timestamp: new Date(),
      type: "product_purchased",
      userId: "",
      productId: "",
      amount: -1,
    },
  ];

  const userEventProcessor = new UserCreatedEventProcessor();
  const productEventProcessor = new ProductPurchasedEventProcessor();

  const userEventResult = await userEventProcessor.process(userEvents);
  const productEventResult = await productEventProcessor.process(productEvents);

  console.log("UserCreatedEvent processing result:", userEventResult);
  console.log("ProductPurchasedEvent processing result:", productEventResult);
}
