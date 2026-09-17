package pro.wewed.app.models

enum class ShellFixtureState(val title: String) {
    POPULATED("Populated"),
    EMPTY("Empty"),
    LOADING("Loading"),
    ERROR("Error"),
    OFFLINE("Offline"),
    ATTENTION("Attention"),
    READ_ONLY("Read-Only"),
    EDITABLE("Editable")
}
