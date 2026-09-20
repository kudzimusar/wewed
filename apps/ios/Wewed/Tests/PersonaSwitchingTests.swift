import XCTest
@testable import WewedKit

final class PersonaSwitchingTests: XCTestCase {
    @MainActor
    func testAllPersonasMappedToValidRoles() {
        let personas = DevelopmentPersona.allPersonas
        XCTAssertEqual(personas.count, 9)
        // Two guest personas exist deliberately, so guest identity binding cannot pass by
        // collection order (P0-4).
        XCTAssertEqual(personas.filter { $0.role == .guest }.count, 2)
        for persona in personas {
            XCTAssertFalse(persona.role.roleId.isEmpty)
            XCTAssertFalse(persona.name.isEmpty)
            XCTAssertFalse(persona.weddingId.isEmpty)
        }
    }

    @MainActor
    func testPersonaSwitchingUpdatesSession() {
        let session = SessionStore()
        
        // Initial couple
        XCTAssertEqual(session.currentRole, .couple)

        // Switch to planner
        if let planner = DevelopmentPersona.allPersonas.first(where: { $0.role == .planner }) {
            session.switchPersona(planner)
            XCTAssertEqual(session.currentRole, .planner)
            XCTAssertEqual(session.activePersona?.id, planner.id)
            XCTAssertEqual(session.currentUserName, planner.name)
        } else {
            XCTFail("Planner persona not found")
        }

        // Switch to vendor
        if let vendor = DevelopmentPersona.allPersonas.first(where: { $0.role == .vendor }) {
            session.switchPersona(vendor)
            XCTAssertEqual(session.currentRole, .vendor)
            XCTAssertEqual(session.currentRole.title, "Vendor & Staff")
        } else {
            XCTFail("Vendor persona not found")
        }
    }
}
