// Appended to gen/android/app/build.gradle.kts after `tauri android init` to add
// release signing (that generated file is gitignored and regenerated). Used by CI
// and the local post-init step. See desktop/README.md "Android release signing".
run {
    val keystorePropertiesFile = rootProject.file("keystore.properties")
    if (keystorePropertiesFile.exists()) {
        val keystoreProperties = Properties().apply {
            keystorePropertiesFile.inputStream().use { load(it) }
        }
        android {
            signingConfigs {
                create("release") {
                    keyAlias = keystoreProperties.getProperty("keyAlias")
                    keyPassword = keystoreProperties.getProperty("keyPassword")
                    storeFile = file(keystoreProperties.getProperty("storeFile"))
                    storePassword = keystoreProperties.getProperty("storePassword")
                }
            }
            buildTypes.getByName("release").signingConfig =
                signingConfigs.getByName("release")
        }
    }
}
