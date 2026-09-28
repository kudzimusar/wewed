package pro.wewed.app.models

data class BudgetCategory(
    val name: String,
    val allocated: Double,
    val spent: Double
)

data class BudgetSummary(
    val currency: String = "USD",
    val totalBudget: Double,
    val totalAllocated: Double,
    val totalPaid: Double,
    val categories: List<BudgetCategory>
)
