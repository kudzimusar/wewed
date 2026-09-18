package pro.wewed.app

import kotlinx.coroutines.runBlocking
import org.junit.Assert.fail
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.*

class ShadowHTTPContractsTest {

    @Test(expected = NativeEnvironmentGuardError.ShadowPointsToProductionHost::class)
    fun shadowConfigurationRejectsProductionHost() {
        ShadowRepositoryConfiguration(
            baseUrl = "https://wewed.pro",
            environment = NativeDataEnvironment.SHADOW
        )
    }

    @Test
    fun unconfiguredTransportNeverPerformsNetworkTraffic() = runBlocking {
        val configuration = ShadowRepositoryConfiguration(
            baseUrl = "http://127.0.0.1:8787",
            environment = NativeDataEnvironment.SHADOW
        )
        val contract = TransportBackedShadowPlannerWireContract(configuration)

        try {
            contract.plannerDashboardJson()
            fail("Unconfigured Shadow transport must never perform network traffic.")
        } catch (_: ShadowAPIError.TransportNotConfigured) {
        }
    }
}
