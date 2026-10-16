export function ArmoreumLogoImages() {
  return (
    <>
      <img
        className="armoreum-logo-image armoreum-logo-image-light"
        src={`${import.meta.env.BASE_URL}armoreum-logo-light.png`}
        alt=""
        aria-hidden="true"
      />
      <img
        className="armoreum-logo-image armoreum-logo-image-dark"
        src={`${import.meta.env.BASE_URL}armoreum-logo-dark.png`}
        alt=""
        aria-hidden="true"
      />
    </>
  );
}
