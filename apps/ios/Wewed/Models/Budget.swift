import Foundation

public struct BudgetCategory: Identifiable, Codable, Equatable, Sendable {
    public var id: String { name }
    public let name: String
    public let allocated: Double
    public let spent: Double

    public init(name: String, allocated: Double, spent: Double) {
        self.name = name
        self.allocated = allocated
        self.spent = spent
    }
}

public struct BudgetSummary: Codable, Equatable, Sendable {
    public let currency: String
    public let totalBudget: Double
    public let totalAllocated: Double
    public let totalPaid: Double
    public let categories: [BudgetCategory]

    public init(
        currency: String = "USD",
        totalBudget: Double,
        totalAllocated: Double,
        totalPaid: Double,
        categories: [BudgetCategory]
    ) {
        self.currency = currency
        self.totalBudget = totalBudget
        self.totalAllocated = totalAllocated
        self.totalPaid = totalPaid
        self.categories = categories
    }
}
