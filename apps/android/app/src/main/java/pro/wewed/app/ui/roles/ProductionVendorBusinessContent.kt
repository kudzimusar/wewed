package pro.wewed.app.ui.roles

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import pro.wewed.app.services.VendorBusinessFetch
import pro.wewed.app.services.VendorBusinessRepository

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §A.
 *
 * The real production Vendor business shell: business identity, catalog, offerings and bookings —
 * never the wedding graph (a `vendor:business` grant has no wedding ActorAssignment). Each section
 * fetches independently and shows its own honest EMPTY/UNSUPPORTED/failed state rather than one
 * shared all-or-nothing loader, so a transient failure on one section never hides the others.
 */
@Composable
fun ProductionVendorBusinessContent(
    repository: VendorBusinessRepository,
    onSignOut: (() -> Unit)? = null,
    onSwitchContext: (() -> Unit)? = null,
) {
    var identity by remember { mutableStateOf<VendorBusinessFetch<pro.wewed.app.services.VendorBusinessIdentity>?>(null) }
    var catalog by remember { mutableStateOf<VendorBusinessFetch<List<pro.wewed.app.services.VendorCatalogItem>>?>(null) }
    var offerings by remember { mutableStateOf<VendorBusinessFetch<List<pro.wewed.app.services.VendorCatalogOffering>>?>(null) }
    var bookings by remember { mutableStateOf<VendorBusinessFetch<List<pro.wewed.app.services.VendorBooking>>?>(null) }

    LaunchedEffect(repository) {
        identity = repository.getBusinessIdentity()
        catalog = repository.getCatalogItems()
        offerings = repository.getCatalogOfferings()
        bookings = repository.getBookings()
    }

    IASectionList(
        title = (identity as? VendorBusinessFetch.Success)?.value?.businessName ?: "Vendor business",
        subtitle = "Business portfolio",
    ) {
        when (val current = identity) {
            null -> IALoading()
            is VendorBusinessFetch.Unavailable -> IACard("Business identity unavailable", "Could not refresh your business identity. No cached data is shown.")
            is VendorBusinessFetch.Success -> {
                IACard("Business", current.value.businessName, current.value.businessType)
                IACard("Status", current.value.businessStatus, "Onboarding: ${current.value.onboardingStatus}")
                IACard("Your role", current.value.role)
            }
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text("Catalog", modifier = Modifier.testTag("vendor-business-catalog-header"))
        when (val current = catalog) {
            null -> IALoading()
            is VendorBusinessFetch.Unavailable -> IACard("Catalog unavailable", "Could not load your catalog right now.")
            is VendorBusinessFetch.Success -> if (current.value.isEmpty()) {
                IACard("No catalog items", "This business has not published any catalog items yet.")
            } else {
                current.value.forEach { item ->
                    IACard(
                        item.name,
                        item.category,
                        item.basePriceCents?.let { "${it / 100.0} ${item.currency}" },
                        item.status,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text("Offerings", modifier = Modifier.testTag("vendor-business-offerings-header"))
        when (val current = offerings) {
            null -> IALoading()
            is VendorBusinessFetch.Unavailable -> IACard("Offerings unavailable", "Could not load your service offerings right now.")
            is VendorBusinessFetch.Success -> if (current.value.isEmpty()) {
                IACard("No offerings", "This business has not published any service offerings yet.")
            } else {
                current.value.forEach { offering -> IACard(offering.displayName, offering.category, null, offering.status) }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text("Bookings", modifier = Modifier.testTag("vendor-business-bookings-header"))
        when (val current = bookings) {
            null -> IALoading()
            is VendorBusinessFetch.Unavailable -> IACard("Bookings unavailable", "Could not load your bookings right now.")
            is VendorBusinessFetch.Success -> if (current.value.isEmpty()) {
                IACard("No bookings", "This business has no bookings recorded yet.")
            } else {
                current.value.forEach { booking ->
                    IACard(
                        booking.weddingTitle ?: booking.publicReference,
                        booking.category,
                        booking.totalCents?.let { "${it / 100.0} ${booking.currency ?: ""}" },
                        booking.status,
                    )
                }
            }
        }

        onSwitchContext?.let {
            TextButton(onClick = it, modifier = Modifier.testTag("vendor-business-switch-context")) { Text("Switch context") }
        }
        onSignOut?.let {
            TextButton(onClick = it, modifier = Modifier.testTag("vendor-business-sign-out")) { Text("Sign out") }
        }
    }
}
