import {
  IonButton,
  IonIcon,
  IonLabel,
  useIonViewWillEnter,
} from "@ionic/react";
import { t } from "i18next";
import { peopleOutline } from "ionicons/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Agent } from "../../../core/agent/agent";
import { MiscRecordId } from "../../../core/agent/agent.types";
import { BasicRecord } from "../../../core/agent/records";
import {
  CredentialShortDetails,
  CredentialStatus,
} from "../../../core/agent/services/credentialService.types";
import { IdentifierType } from "../../../core/agent/services/identifier.types";
import { i18n } from "../../../i18n";
import { TabsRoutePath } from "../../../routes/paths";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  getCredsArchivedCache,
  setCredsArchivedCache,
} from "../../../store/reducers/credsArchivedCache";
import {
  getCredentialsFilters,
  getCredsCache,
  getFavouritesCredsCache,
  setCredentialsFilters,
  setCredsCache,
} from "../../../store/reducers/credsCache";
import {
  setCurrentRoute,
  setToastMsg,
  showConnections,
} from "../../../store/reducers/stateCache";
import { ArchivedCredentials } from "../../components/ArchivedCredentials";
import { CardSlider } from "../../components/CardSlider";
import { CardsPlaceholder } from "../../components/CardsPlaceholder";
import { FilterChip } from "../../components/FilterChip/FilterChip";
import { AllowedChipFilter } from "../../components/FilterChip/FilterChip.types";
import { FilteredItemsPlaceholder } from "../../components/FilteredItemsPlaceholder";
import { TabLayout } from "../../components/layout/TabLayout";
import { ListHeader } from "../../components/ListHeader";
import { RemovePendingAlert } from "../../components/RemovePendingAlert";
import {
  CardList as CredentialCardList,
  SwitchCardView,
} from "../../components/SwitchCardView";
import { CardType, ToastMsgType } from "../../globals/types";
import { useOnlineStatusEffect } from "../../hooks";
import { showError } from "../../utils/error";
import { combineClassNames } from "../../utils/style";
import { StartAnimationSource } from "../Identifiers/Identifiers.types";
import "./Credentials.scss";
import { CredentialsFilters } from "./Credentials.types";

const CLEAR_STATE_DELAY = 1000;
const CREDENTIAL_TYPE_ID_LIKE_PATTERN = /[A-Za-z0-9_-]{40,}/;
const CREDENTIAL_SERVER_API_BASE = (
  process.env.REACT_APP_CREDENTIAL_SERVER_API || "http://localhost:3001"
)
  .trim()
  .replace(/\/+$/, "");

type CredentialSchemaListResponse = {
  success?: boolean;
  data?: Array<{
    id?: string;
    name?: string;
  }>;
};

const LOCAL_SCHEMA_NAME_FALLBACK: Record<string, string> = {
  "EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao":
    "Qualified vLEI Issuer Credential",
  "EHYYZFJas0_cgo3nA1_BeeyWRIzyWqic3pM-LdYmL_R6": "FaydaVerifiedAutoIssue",
  "EJxnJdxkHbRw2wVFNe4IUOPLt8fEtg9Sr3WyTjlgKoIb": "Rare EVO 2024 Attendee",
  "EKgoX7j8AIkUv44WtJzcO_CvMbVuYH367hrivzaAKacm": "FaydaFairwayId",
  "EL9oOWU_7zQn_rD--Xsgi3giCWnFDaNvFMUGTOZx1ARO": "Foundation Employee",
  "ENPXp1vQzRF6JwIuS-mp2U8Uf1MoADoP_GqQ62VsDZWY":
    "Legal Entity vLEI Credential",
};

const shouldResolveCredentialName = (credential: CredentialShortDetails) => {
  const credentialType = (credential.credentialType || "").trim();
  const schemaSaid = (credential.schema || "").trim();

  if (!credentialType) {
    return true;
  }

  if (schemaSaid && credentialType === schemaSaid) {
    return true;
  }

  return CREDENTIAL_TYPE_ID_LIKE_PATTERN.test(credentialType);
};

const AdditionalButtons = ({
  handleConnections,
}: {
  handleConnections: () => void;
}) => {
  return (
    <>
      <IonButton
        shape="round"
        className="connections-button"
        data-testid="connections-button"
        onClick={handleConnections}
      >
        <IonIcon
          slot="icon-only"
          icon={peopleOutline}
          color="primary"
        />
      </IonButton>
    </>
  );
};

const Credentials = () => {
  const pageId = "credentials-tab";
  const dispatch = useAppDispatch();
  const credsCache = useAppSelector(getCredsCache);
  const archivedCreds = useAppSelector(getCredsArchivedCache);
  const credentialsFiltersCache = useAppSelector(getCredentialsFilters);
  const favouriteCredentialsCache = useAppSelector(getFavouritesCredsCache);
  const [archivedCredentialsIsOpen, setArchivedCredentialsIsOpen] =
    useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [navAnimation, setNavAnimation] =
    useState<StartAnimationSource>("none");
  const favouriteContainerElement = useRef<HTMLDivElement>(null);
  const [deletedPendingItem, setDeletePendingItem] =
    useState<CredentialShortDetails | null>(null);
  const [openDeletePendingAlert, setOpenDeletePendingAlert] = useState(false);
  const [credentialNameOverrides, setCredentialNameOverrides] = useState<
    Record<string, string>
  >({});
  const [schemaNamesById, setSchemaNamesById] = useState<Record<string, string>>(
    {}
  );
  const [individualCredentials, setIndividualCredentials] = useState<
    CredentialShortDetails[]
  >([]);
  const [groupCredentials, setGroupCredentials] = useState<
    CredentialShortDetails[]
  >([]);
  const selectedFilter = credentialsFiltersCache ?? CredentialsFilters.All;

  useEffect(() => {
    let cancelled = false;

    const loadSchemaNames = async () => {
      try {
        const response = await fetch(`${CREDENTIAL_SERVER_API_BASE}/schemas`);
        if (!response.ok) {
          return;
        }

        const payload =
          (await response.json()) as CredentialSchemaListResponse | null;
        const schemaItems = Array.isArray(payload?.data) ? payload.data : [];
        const schemaMap = schemaItems.reduce<Record<string, string>>(
          (result, item) => {
            const id = String(item?.id || "").trim();
            const name = String(item?.name || "").trim();

            if (!id || !name) {
              return result;
            }

            result[id] = name;
            return result;
          },
          {}
        );

        if (!cancelled && Object.keys(schemaMap).length > 0) {
          setSchemaNamesById(schemaMap);
        }
      } catch {
        // No-op: credentials page can still try other resolution paths.
      }
    };

    void loadSchemaNames();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyCredentialNameOverride = useCallback(
    (credential: CredentialShortDetails): CredentialShortDetails => {
      const overrideName = credentialNameOverrides[credential.id];
      if (!overrideName || overrideName === credential.credentialType) {
        return credential;
      }

      return {
        ...credential,
        credentialType: overrideName,
      };
    },
    [credentialNameOverrides]
  );

  const displayCreds = useMemo(
    () => credsCache.map(applyCredentialNameOverride),
    [credsCache, applyCredentialNameOverride]
  );

  const displayArchivedCreds = useMemo(
    () => archivedCreds.map(applyCredentialNameOverride),
    [archivedCreds, applyCredentialNameOverride]
  );

  const revokedCreds = displayCreds.filter(
    (item) => item.status === CredentialStatus.REVOKED
  );
  const pendingCreds = displayCreds.filter(
    (item) => item.status === CredentialStatus.PENDING
  );
  const confirmedCreds = useMemo(
    () =>
      displayCreds.filter((item) => item.status === CredentialStatus.CONFIRMED),
    [displayCreds]
  );

  useEffect(() => {
    let cancelled = false;

    const uniqueCredentials = new Map<string, CredentialShortDetails>();
    [...displayCreds, ...displayArchivedCreds].forEach((credential) => {
      if (uniqueCredentials.has(credential.id)) {
        return;
      }
      uniqueCredentials.set(credential.id, credential);
    });

    const unresolvedCredentials = [...uniqueCredentials.values()].filter(
      (credential) =>
        shouldResolveCredentialName(credential) &&
        !credentialNameOverrides[credential.id]
    );

    if (unresolvedCredentials.length === 0) {
      return;
    }

    const resolveCredentialNames = async () => {
      const schemaResolved = Object.fromEntries(
        unresolvedCredentials
          .map((credential) => {
            const schemaId = String(credential.schema || "").trim();
            const credentialType = String(credential.credentialType || "").trim();
            const resolvedTitle =
              schemaNamesById[schemaId] ||
              schemaNamesById[credentialType] ||
              LOCAL_SCHEMA_NAME_FALLBACK[schemaId] ||
              LOCAL_SCHEMA_NAME_FALLBACK[credentialType];

            if (!resolvedTitle || resolvedTitle === credential.credentialType) {
              return undefined;
            }

            return [credential.id, resolvedTitle] as const;
          })
          .filter(
            (entry): entry is readonly [string, string] => Boolean(entry)
          )
      );

      const schemaResolvedIds = new Set(Object.keys(schemaResolved));
      if (schemaResolvedIds.size > 0) {
        setCredentialNameOverrides((current) => ({
          ...current,
          ...schemaResolved,
        }));
      }

      const credentialsStillUnresolved = unresolvedCredentials.filter(
        (credential) => !schemaResolvedIds.has(credential.id)
      );

      if (credentialsStillUnresolved.length === 0) {
        return;
      }

      const resolvedEntries = await Promise.all(
        credentialsStillUnresolved.map(async (credential) => {
          try {
            const details = await Agent.agent.credentials.getCredentialDetailsById(
              credential.id
            );
            const resolvedTitle =
              typeof details?.s?.title === "string"
                ? details.s.title.trim()
                : "";

            if (!resolvedTitle || resolvedTitle === credential.credentialType) {
              return undefined;
            }

            return [credential.id, resolvedTitle] as const;
          } catch {
            return undefined;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const updates = Object.fromEntries(
        resolvedEntries.filter(
          (entry): entry is readonly [string, string] => Boolean(entry)
        )
      );

      if (Object.keys(updates).length === 0) {
        return;
      }

      setCredentialNameOverrides((current) => ({
        ...current,
        ...updates,
      }));
    };

    void resolveCredentialNames();

    return () => {
      cancelled = true;
    };
  }, [
    displayCreds,
    displayArchivedCreds,
    credentialNameOverrides,
    schemaNamesById,
  ]);

  const refreshCredentials = useCallback(async () => {
    try {
      const creds = await Agent.agent.credentials.getCredentials();
      dispatch(setCredsCache(creds));
    } catch (e) {
      showError("Unable to refresh credentials", e, dispatch);
    }
  }, [dispatch]);

  const fetchArchivedCreds = useCallback(async () => {
    try {
      const creds = await Agent.agent.credentials.getCredentials(true);
      dispatch(setCredsArchivedCache(creds));
    } catch (e) {
      showError("Unable to get archived credential", e, dispatch);
    }
  }, [dispatch]);

  const findTimeById = (id: string) => {
    const found = favouriteCredentialsCache.find((item) => item.id === id);
    return found ? found.time : null;
  };

  const favouriteCredentials = displayCreds.filter((cred) =>
    favouriteCredentialsCache?.some((fav) => fav.id === cred.id)
  );

  const sortedFavouriteCredentials = favouriteCredentials.sort((a, b) => {
    const timeA = findTimeById(a.id);
    const timeB = findTimeById(b.id);

    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;

    return timeA - timeB;
  });

  useEffect(() => {
    setShowPlaceholder(confirmedCreds.length + pendingCreds.length === 0);
    setIndividualCredentials(
      confirmedCreds.filter(
        (cred) => cred.identifierType !== IdentifierType.Group
      )
    );
    setGroupCredentials(
      confirmedCreds.filter(
        (cred) => cred.identifierType !== IdentifierType.Individual
      )
    );
  }, [confirmedCreds, pendingCreds.length]);

  useOnlineStatusEffect(refreshCredentials);
  useOnlineStatusEffect(fetchArchivedCreds);

  const handleConnections = () => {
    dispatch(showConnections(true));
  };

  useIonViewWillEnter(() => {
    dispatch(setCurrentRoute({ path: TabsRoutePath.CREDENTIALS }));
    void refreshCredentials();
  });

  const handleShowNavAnimation = (source: StartAnimationSource) => {
    if (favouriteContainerElement.current && source !== "favourite") {
      favouriteContainerElement.current.style.height =
        favouriteContainerElement.current.scrollHeight + "px";
    }

    setNavAnimation(source);

    setTimeout(() => {
      setNavAnimation("none");
      if (favouriteContainerElement.current) {
        favouriteContainerElement.current.removeAttribute("style");
      }
    }, CLEAR_STATE_DELAY);
  };

  const tabClasses = combineClassNames("credential-tab", {
    "cards-credential-nav": navAnimation === "cards",
    "favorite-credential-nav": navAnimation === "favourite",
  });

  const handleArchivedCredentialsDisplayChange = (value: boolean) => {
    if (value === archivedCredentialsIsOpen) return;
    setArchivedCredentialsIsOpen(value);
    fetchArchivedCreds();
  };

  const ArchivedCredentialsButton = () => {
    return (
      <div
        className={`archived-credentials-button-container${
          archivedCreds?.length > 0 || revokedCreds.length > 0
            ? " visible"
            : " hidden"
        }`}
      >
        <IonButton
          fill="outline"
          className="secondary-button"
          data-testid="cred-archived-revoked-button"
          onClick={() => setArchivedCredentialsIsOpen(true)}
        >
          <IonLabel color="secondary">
            {i18n.t("tabs.credentials.tab.viewarchived")}
          </IonLabel>
        </IonButton>
      </div>
    );
  };

  const deletePendingCheck = {
    title: i18n.t("tabs.credentials.tab.deletepending.title"),
    description: i18n.t("tabs.credentials.tab.deletepending.description"),
    button: i18n.t("tabs.credentials.tab.deletepending.button"),
  };

  const deletePendingCred = async () => {
    if (!deletedPendingItem) return;
    setDeletePendingItem(null);

    try {
      await Agent.agent.credentials.archiveCredential(deletedPendingItem.id);
      await Agent.agent.credentials.markCredentialPendingDeletion(
        deletedPendingItem.id
      );

      dispatch(setToastMsg(ToastMsgType.CREDENTIAL_DELETED));

      const creds = await Agent.agent.credentials.getCredentials();
      dispatch(setCredsCache(creds));
    } catch (e) {
      showError(
        "Unable to delete credential",
        e,
        dispatch,
        ToastMsgType.DELETE_CRED_FAIL
      );
    }
  };

  const filterOptions = [
    {
      filter: CredentialsFilters.All,
      label: i18n.t("tabs.credentials.tab.filters.all"),
    },
    {
      filter: CredentialsFilters.Individual,
      label: i18n.t("tabs.credentials.tab.filters.individual"),
    },
    {
      filter: CredentialsFilters.Group,
      label: i18n.t("tabs.credentials.tab.filters.group"),
    },
  ];

  const handleSelectFilter = (filter: AllowedChipFilter) => {
    Agent.agent.basicStorage
      .createOrUpdateBasicRecord(
        new BasicRecord({
          id: MiscRecordId.APP_CRED_SELECTED_FILTER,
          content: {
            filter: filter,
          },
        })
      )
      .then(() => {
        dispatch(setCredentialsFilters(filter as CredentialsFilters));
      });
  };

  return (
    <>
      <TabLayout
        pageId={pageId}
        header={true}
        customClass={tabClasses}
        title={`${i18n.t("tabs.credentials.tab.title")}`}
        additionalButtons={
          <AdditionalButtons handleConnections={handleConnections} />
        }
        placeholder={
          showPlaceholder && (
            <CardsPlaceholder testId={pageId}>
              <p>
                <i>{i18n.t("tabs.credentials.tab.placeholder")}</i>
              </p>
              <ArchivedCredentialsButton />
            </CardsPlaceholder>
          )
        }
      >
        {!showPlaceholder && (
          <>
            {favouriteCredentials.length > 0 && (
              <div
                ref={favouriteContainerElement}
                className="credentials-tab-content-block credential-favourite-cards"
                data-testid="favourite-container-element"
              >
                <CardSlider
                  title={`${i18n.t("tabs.credentials.tab.favourites")}`}
                  name="favs"
                  cardType={CardType.CREDENTIALS}
                  cardsData={sortedFavouriteCredentials}
                  onShowCardDetails={() => handleShowNavAnimation("favourite")}
                />
              </div>
            )}
            {!!confirmedCreds.length && (
              <SwitchCardView
                className="credentials-tab-content-block credential-cards"
                cardTypes={CardType.CREDENTIALS}
                cardsData={
                  selectedFilter === CredentialsFilters.All
                    ? confirmedCreds
                    : selectedFilter === CredentialsFilters.Individual
                      ? individualCredentials
                      : groupCredentials
                }
                onShowCardDetails={() => handleShowNavAnimation("cards")}
                title={`${i18n.t("tabs.credentials.tab.allcreds")}`}
                name="allcreds"
                filters={
                  <div className="credentials-tab-chips">
                    {filterOptions.map((option) => (
                      <FilterChip
                        key={option.filter}
                        filter={option.filter}
                        label={option.label}
                        isActive={option.filter === selectedFilter}
                        onClick={handleSelectFilter}
                      />
                    ))}
                  </div>
                }
                placeholder={
                  <FilteredItemsPlaceholder
                    placeholderText={t(
                      "tabs.credentials.tab.filters.placeholder",
                      {
                        type: selectedFilter,
                      }
                    )}
                    testId={pageId}
                  />
                }
              />
            )}
            {!!pendingCreds.length && (
              <div className="credetial-tab-content-block pending-container">
                <ListHeader
                  title={`${i18n.t("tabs.credentials.tab.pendingcred")}`}
                />
                <CredentialCardList
                  cardsData={pendingCreds}
                  cardTypes={CardType.CREDENTIALS}
                  testId="pending-creds-list"
                  onCardClick={(cred) => {
                    setDeletePendingItem(cred as CredentialShortDetails);
                    setOpenDeletePendingAlert(true);
                  }}
                />
              </div>
            )}
            <ArchivedCredentialsButton />
          </>
        )}
      </TabLayout>
      <RemovePendingAlert
        pageId={pageId}
        openFirstCheck={openDeletePendingAlert}
        firstCheckProps={deletePendingCheck}
        onClose={() => setOpenDeletePendingAlert(false)}
        secondCheckTitle={`${i18n.t(
          "tabs.credentials.tab.deletepending.secondchecktitle"
        )}`}
        onDeletePendingItem={deletePendingCred}
      />
      <ArchivedCredentials
        revokedCreds={revokedCreds}
        archivedCreds={displayArchivedCreds}
        archivedCredentialsIsOpen={archivedCredentialsIsOpen}
        setArchivedCredentialsIsOpen={handleArchivedCredentialsDisplayChange}
      />
    </>
  );
};

export { Credentials };
