import { useParams } from "react-router-dom";
import PlantAlarmList from "./PlantAlarmList.js";

const PlantAlarmListWrapper = () => {
  const { plantId } = useParams();
  return <PlantAlarmList plantId={plantId} />;
};
export default PlantAlarmListWrapper;