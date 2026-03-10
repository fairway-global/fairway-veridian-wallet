import { SwapHorizontalCircleOutlined } from "@mui/icons-material";
import {
  Box,
  Button,
  Paper,
  TableCell,
  TableRow,
  Tooltip,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppTable, useTable } from "../../components/AppTable";
import {
  AppTableBaseData,
  AppTableHeader,
} from "../../components/AppTable/AppTable.types";
import { filter, FilterBar } from "../../components/FilterBar";
import { FilterData } from "../../components/FilterBar/FilterBar.types";
import { PageHeader } from "../../components/PageHeader";
import { RoutePath } from "../../const/route";
import { RequestPresentationModal } from "../../components/RequestPresentationModal";
import { i18n } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchPresentationRequests } from "../../store/reducers/connectionsSlice";
import {
  PresentationRequestData,
  PresentationRequestStatus,
} from "../../store/reducers/connectionsSlice.types";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";
import "./RequestPresentation.scss";

interface PresentationRequestRow extends AppTableBaseData {
  connectionName: string;
  credentialType: string;
  attribute: string;
  result: string;
  requestDate: number;
  status: PresentationRequestStatus;
}

const headers: AppTableHeader<PresentationRequestRow>[] = [
  {
    id: "connectionName",
    label: i18n.t("pages.requestPresentation.table.name"),
  },
  {
    id: "credentialType",
    label: i18n.t("pages.requestPresentation.table.credential"),
  },
  {
    id: "attribute",
    label: i18n.t("pages.requestPresentation.table.attribute"),
  },
  {
    id: "result",
    label: i18n.t("pages.requestPresentation.table.result"),
  },
  {
    id: "requestDate",
    label: i18n.t("pages.requestPresentation.table.requestDate"),
  },
  {
    id: "status",
    label: i18n.t("pages.requestPresentation.table.status.header"),
  },
];

function formatRequestedAttributes(
  request: PresentationRequestData
): string {
  const entries = Object.entries(request.requestedAttributes || {});
  if (!entries.length) {
    return i18n.t("pages.requestPresentation.table.attributeAny");
  }

  if (entries.length === 1) {
    return `${entries[0][0]}: ${entries[0][1]}`;
  }

  return `${entries[0][0]}: ${entries[0][1]} (+${entries.length - 1})`;
}

function formatResult(request: PresentationRequestData): string {
  if (
    request.status === PresentationRequestStatus.Rejected ||
    request.status === PresentationRequestStatus.Failed
  ) {
    return (
      request.failureReason ||
      i18n.t("pages.requestPresentation.table.resultRejected")
    );
  }

  if (
    request.status === PresentationRequestStatus.Verified ||
    request.status === PresentationRequestStatus.Completed
  ) {
    if (request.presentedCredentialId) {
      return `${i18n.t("pages.requestPresentation.table.resultVerified")} ${request.presentedCredentialId}`;
    }

    return i18n.t("pages.requestPresentation.table.resultVerified");
  }

  return i18n.t("pages.requestPresentation.table.resultPending");
}

export const RequestPresentation = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const presentationRequests = useAppSelector(
    (state) => state.connections.presentationRequests
  );
  const contacts = useAppSelector((state) => state.connections.contacts);
  const schemas = useAppSelector((state) => state.schemasCache.schemas);
  const [openModal, setOpenModal] = useState(false);

  const rows: PresentationRequestRow[] = presentationRequests.map((request) => {
    const contact = contacts.find((item) => item.id === request.holderDid);
    const schema = schemas.find((item) => item.id === request.schemaId);

    return {
      id: request.id,
      connectionName: contact?.alias || request.holderDid,
      credentialType: schema?.name || request.schemaId,
      attribute: formatRequestedAttributes(request),
      result: formatResult(request),
      requestDate: request.requestDate,
      status: request.status,
    };
  });

  const {
    order,
    orderBy,
    page,
    rowsPerPage,
    handleRequestSort,
    handleChangePage,
    handleChangeRowsPerPage,
    visibleRows,
  } = useTable(rows, "requestDate");

  useEffect(() => {
    void dispatch(fetchPresentationRequests());
  }, [dispatch]);

  const handleClick = () => {
    setOpenModal(true);
  };

  const [filterData, setFilterData] = useState<FilterData>({
    startDate: null,
    endDate: null,
    keyword: "",
  });

  const visibleData = filter(visibleRows, filterData, {
    date: "requestDate",
    keyword: ["connectionName", "credentialType", "attribute", "result", "status"],
  });

  return (
    <>
      <Box
        className="request-presentation-page"
        sx={{ padding: "0 2.5rem 2.5rem" }}
      >
        <PageHeader
          title={`${i18n.t("pages.requestPresentation.title", {
            number: presentationRequests.length,
          })}`}
          sx={{
            margin: "1.5rem 0",
          }}
          action={
            <Button
              className="add-connection-button primary-button"
              aria-haspopup="true"
              variant="contained"
              disableElevation
              disableRipple
              onClick={handleClick}
              startIcon={<SwapHorizontalCircleOutlined />}
            >
              {i18n.t("pages.requestPresentation.action")}
            </Button>
          }
        />
        <FilterBar
          onChange={setFilterData}
          totalFound={visibleData.length}
        />
        <Paper className="request-presentation-table">
          <AppTable
            order={order}
            rows={visibleData}
            onRenderRow={(row) => {
              return (
                <TableRow
                  hover
                  role="checkbox"
                  tabIndex={-1}
                  key={row.id}
                  className="table-row"
                  onClick={() =>
                    navigate(RoutePath.RequestPresentationDetail.replace(":id", row.id))
                  }
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell
                    component="th"
                    scope="row"
                  >
                    <Tooltip
                      title={row.connectionName}
                      placement="top"
                    >
                      <span>{row.connectionName}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell
                    component="th"
                    scope="row"
                  >
                    <Tooltip
                      title={row.credentialType}
                      placement="top"
                    >
                      <span>{row.credentialType}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left">
                    <Tooltip
                      title={row.attribute}
                      placement="top"
                    >
                      <span>{row.attribute}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left">
                    <Tooltip
                      title={row.result}
                      placement="top"
                    >
                      <span>{row.result}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell
                    component="th"
                    scope="row"
                  >
                    <Tooltip
                      title={formatDateTime(new Date(row.requestDate))}
                      placement="top"
                    >
                      <span>{formatDate(new Date(row.requestDate))}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left">
                    <Box className={`label ${row.status}`}>
                      {i18n.t(
                        `pages.requestPresentation.table.status.${row.status}`
                      )}
                    </Box>
                  </TableCell>
                  <TableCell />
                </TableRow>
              );
            }}
            onRequestSort={handleRequestSort}
            orderBy={orderBy}
            headers={headers}
            pagination={{
              component: "div",
              count: visibleData.length,
              rowsPerPage: rowsPerPage,
              page: page,
              onPageChange: handleChangePage,
              onRowsPerPageChange: handleChangeRowsPerPage,
            }}
          />
        </Paper>
      </Box>
      <RequestPresentationModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
        }}
      />
    </>
  );
};
